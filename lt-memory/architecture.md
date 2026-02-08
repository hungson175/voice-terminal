# Architecture Details

## Electron App Packaging

**electron-builder** packages into `dist/mac-arm64/Voice Terminal.app`:
- `electron/`, `ui/`, `assets/` → inside asar (transparent `__dirname` paths work)
- `config.json` → `extraResources` at `Contents/Resources/config.json`
- `assets/icon.png` (1024x1024) → auto-converted to `.icns`
- Tray icon paths need no change (Electron reads asar transparently)

**Path resolution in main.js:**
- Config: `app.isPackaged ? process.resourcesPath : __dirname/..`
- UI/preload: `__dirname`-relative (works inside asar)
- PATH fix: append `/opt/homebrew/bin`, `/usr/local/bin`, kitty app path when packaged

## Credential Flow

1. `credentials.js` uses `safeStorage.encryptString()`/`decryptString()` (macOS Keychain)
2. Stores encrypted base64 in `~/Library/Application Support/voice-terminal/credentials.json`
3. `hasCredentials()` → checks file exists with required keys
4. `main.js:loadApiKeys()` → try Keychain first, fall back to `.env` in dev
5. `main.js:getStartUrl()` → routes to `setup.html` or `index.html`
6. Setup page saves keys via IPC → main reloads to `index.html`
7. "Reset API Keys" in main UI → clears credentials → reloads to `setup.html`

## Soniox Context Injection (experiment branch)

Context object sent with WebSocket init message:
- `general`: `[{key: "domain", value: "Software Development"}]`
- `text`: Last 50 lines from selected Kitty terminal (up to 8000 chars)
- `terms`: 30+ programming terms for vocabulary boosting
- `translation_terms`: `[{source, target}]` array mapping Vietnamese phonetic misheards to correct terms

Context is built fresh each time recording starts (`buildSonioxContext()` in renderer.js).
With context injection, LLM correction step is bypassed — raw Soniox transcript sent directly.

## Module Interfaces

### kitty-service.js
- `discoverSockets()` — scans `/tmp/mykitty-*` for socket files
- `kittyCommand(socket, args, stdinData)` — runs `kitty @` with optional stdin piping
- `sendCommand(socket, windowId, text)` — send-text via stdin + 500ms delay for long text + send-key Return
- `listTerminals()` — returns flat array of `{id, windowId, socket, title, cwd, displayName}`
- `getContext(socket, windowId, lines)` — last N lines of terminal text

### stt.js (Soniox WebSocket, renderer process)
- `start(apiKey, context)` — connects WebSocket, sends init config with optional context object, starts audio streaming
- Protocol: JSON config first (text frame), then binary PCM16 audio only
- `_handleMessage()` — parses token stream, accumulates final/interim transcript
- `onTranscript(fullTranscript, finalTranscript, hasFinal)` callback

### stopword.js
- Detects configurable stop phrase (default: "thank you") at end of transcript
- Handles variations with trailing punctuation
- Stateful: must reset after each detection

### llm-service.js (Grok/xAI) — disabled on experiment branch
- System prompt includes STT error correction mappings
- Receives terminal context (last 50 lines) for disambiguation
- Preserves swear words (frustration signals)

### Terminal Selector (Electron UI)
- Custom dropdown replaces native `<select>` — shows terminal name + hover preview
- Preview fetches last 20 lines via `get-terminal-preview` IPC
- Previews cached in a `Map` per dropdown session (cleared on reopen)
- Dropdown refreshes terminal list on every open

### Python Modules (future CLI mode)
- `src/voice_terminal/kitty.py`, `audio.py`, `stt.py`, `stopword.py`, `llm.py`
