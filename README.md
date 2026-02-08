# Voice Terminal

macOS menubar app that converts voice commands into terminal input. Speak naturally in Vietnamese, English, or a mix of both — your words get transcribed and sent directly to a [Kitty](https://sw.kovidgoyal.net/kitty/) terminal window.

<!-- TODO: Add demo video/GIF here -->
<!-- ![Demo](assets/demo.gif) -->

## How It Works

```
Mic → Soniox STT (WebSocket) → Stop word detection → [Optional LLM correction] → kitty @ send-text
```

1. **Record** — Click the mic button or use the menubar icon
2. **Transcribe** — Real-time speech-to-text via Soniox (supports Vietnamese + English)
3. **Correct** *(optional)* — LLM (Grok/xAI) fixes transcription errors into valid commands
4. **Send** — Command is typed into the selected Kitty terminal window

## Requirements

- **macOS** (Apple Silicon or Intel)
- **[Kitty terminal](https://sw.kovidgoyal.net/kitty/)** with remote control enabled
- **[Soniox](https://soniox.com/) API key** (required — for speech-to-text)
- **[xAI](https://x.ai/) API key** (optional — for LLM command correction)

### Kitty Configuration

Add these lines to `~/.config/kitty/kitty.conf`:

```
allow_remote_control yes
listen_on unix:/tmp/mykitty-{kitty_pid}
```

Restart Kitty after editing.

## Install

### Option 1: Download DMG

<!-- TODO: Add GitHub Releases link when first release is published -->
Download the latest `.dmg` from [Releases](https://github.com/hungson175/voice-terminal/releases), open it, and drag **Voice Terminal** to `/Applications`.

### Option 2: Build from source

```bash
git clone https://github.com/hungson175/voice-terminal.git
cd voice-terminal
npm install
npm run build
```

The DMG will be in `dist/`. Open it and drag to `/Applications`.

### Option 3: Run in dev mode

```bash
git clone https://github.com/hungson175/voice-terminal.git
cd voice-terminal
npm install
```

Create a `.env` file:

```
SONIOX_API_KEY=your_soniox_key_here
XAI_API_KEY=your_xai_key_here   # optional
```

```bash
npm start
```

## First Run

When launched for the first time (or after resetting keys), the app shows a setup screen where you enter your API keys. Keys are stored securely in the **macOS Keychain** via Electron's `safeStorage`.

In dev mode, keys are read from the `.env` file instead.

## Usage

1. Click the menubar icon to open the popup
2. Select a target Kitty terminal window from the dropdown
3. Click the mic button and speak your command
4. Say **"thank you"** to stop recording (or click the mic again)
5. Review the transcribed command, then click **Send to Terminal**

The app auto-detects all running Kitty windows. Hover over a terminal in the dropdown to preview its current content.

## Configuration

All settings are in `config.json`:

| Key | Description |
|-----|-------------|
| `soniox.model` | STT model (`stt-rt-v4`) |
| `soniox.language_hints` | Languages to detect (`["vi", "en"]`) |
| `llm.provider` | LLM provider (`xai`) |
| `llm.model` | LLM model for correction |
| `voice.stop_word` | Phrase to stop recording (`thank you`) |
| `voice.context_lines` | Lines of terminal context sent to LLM |

## License

MIT
