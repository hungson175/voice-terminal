# CLAUDE.md

## Commands
```bash
npm install                                      # Install Electron dependencies
npm start                                        # Run the menubar app (dev mode)
npm run build:dir                                # Package as .app (dist/mac-arm64/)
npm run build                                    # Package as DMG for distribution
uv sync                                          # Install Python dependencies
uv run pytest                                    # Run all tests
uv run pytest tests/test_kitty.py -v             # Single test file
```

## Architecture
Voice Terminal: macOS menubar app for voice-to-terminal commands (Vietnamese+English mix).

**Pipeline (current, experiment branch):** Mic → Soniox WebSocket (with context injection) → STT → Stop word → kitty send-text
**Pipeline (main branch):** Mic → Soniox → STT → Stop word → LLM correction (Grok/xAI) → kitty send-text

**Electron app:**
- `electron/main.js` — Main process: tray, IPC, credential loading, setup routing
- `electron/preload.js` — Context bridge for renderer
- `electron/credentials.js` — Encrypted API key storage via macOS Keychain (safeStorage)
- `electron/kitty-service.js` — Auto-detect Kitty windows via `/tmp/mykitty-*` sockets
- `electron/llm-service.js` — xAI API for transcript correction (disabled on experiment branch)
- `ui/stt.js` — Soniox WebSocket STT client with context injection support
- `ui/stopword.js` — Stop word detector
- `ui/renderer.js` — UI logic, Soniox context builder, terminal send
- `ui/setup.html` + `ui/setup.js` — First-run API key setup page
- `ui/index.html` + `ui/styles.css` — Menubar popup UI

**Packaging:** electron-builder → `dist/mac-arm64/Voice Terminal.app`. Config in `extraResources`, code in asar.

**Config:** `config.json` — all service URLs, models, and settings. Never hardcode these values.

## Key Conventions
- **Configuration as code**: All URLs, models, thresholds in `config.json`. Secrets encrypted in Keychain, `.env` as dev fallback.
- **No inline scripts**: CSP `default-src 'self'` blocks inline `<script>` tags. All JS must be in external `.js` files.
- **Reference implementation**: Check `AI-teams-controller` at `/Users/sonph36/dev/coding-agents/AI-teams-controller` for proven patterns, NOT the PKM code samples (outdated)
- Kitty terminal must have `allow_remote_control yes` + `listen_on` configured

## Pitfalls
Read [lt-memory/pitfalls.md](lt-memory/pitfalls.md) before modifying tricky areas.

## Planning
- **Current:** [docs/plan/WHITEBOARD.md](docs/plan/WHITEBOARD.md) — active sprint work and decisions
- **Future:** [docs/plan/BACKLOG.md](docs/plan/BACKLOG.md) — sprint plan with deliverables and checklists
- **Past:** git history

## Long-Term Memory
`lt-memory/` uses progressive disclosure — this file stays short with summaries, detail files are read on-demand:
- `pitfalls.md` — Known gotchas and failure patterns
- `architecture.md` — Detailed module interfaces and data flow
