# Voice Terminal

macOS menubar app that converts voice commands into terminal input. Speak naturally in Vietnamese, English, or a mix of both — your words get transcribed and sent directly to a [Kitty](https://sw.kovidgoyal.net/kitty/) terminal window.

[![Demo](https://img.youtube.com/vi/Q9IMOgKkpB0/maxresdefault.jpg)](https://youtu.be/Q9IMOgKkpB0)

## Quick Start

### 1. Install

**One-line install:**

```bash
curl -fsSL https://raw.githubusercontent.com/hungson175/voice-terminal/main/install.sh | bash
```

Or download the `.dmg` manually from [Releases](https://github.com/hungson175/voice-terminal/releases).

### 2. Get API Keys

- **Soniox** (required) — Sign up at [soniox.com](https://soniox.com) and grab your API key
- **xAI / Grok** (optional) — Get a key at [x.ai](https://x.ai) for LLM command correction

### 3. Configure Kitty

Install Kitty if you haven't already:

```bash
curl -L https://sw.kovidgoyal.net/kitty/installer.sh | sh /dev/stdin
```

Then add to `~/.config/kitty/kitty.conf`:

```
allow_remote_control yes
listen_on unix:/tmp/mykitty-{kitty_pid}
```

Restart Kitty after editing.

### 4. Launch

Open **Voice Terminal** from Spotlight or `/Applications`. On first launch, enter your API keys — they're stored securely in the macOS Keychain.

### 5. Use

1. Open **Kitty** and launch **Claude Code** (e.g. `claude` in a Kitty terminal)
2. Click the Voice Terminal menubar icon to open the popup
3. Select the Kitty terminal window running Claude Code from the dropdown
4. Click the mic button and speak your command
5. Say **"thank you"** to stop recording (or click the mic again)
6. Review the transcribed command, then click **Send to Terminal**

## How It Works

```
Mic → Soniox STT (WebSocket) → Stop word detection → [Optional LLM correction] → kitty @ send-text
```

- **Speech-to-text** — Real-time via Soniox WebSocket with context injection (programming terms, terminal context) for better accuracy
- **LLM correction** *(optional)* — Grok/xAI fixes transcription errors into valid shell commands. Automatically skipped if no xAI key is configured
- **Terminal detection** — Auto-discovers all running Kitty windows via `/tmp/mykitty-*` sockets. Hover to preview terminal content

## Requirements

| Requirement | Details |
|---|---|
| **macOS** | Apple Silicon or Intel |
| **Kitty** | With `allow_remote_control yes` and `listen_on` configured |
| **Claude Code** | [Anthropic's CLI](https://docs.anthropic.com/en/docs/claude-code) running inside Kitty |
| **Soniox API key** | Required — for speech-to-text |
| **xAI API key** | Optional — for LLM command correction |

## Install from Source

```bash
git clone https://github.com/hungson175/voice-terminal.git
cd voice-terminal
npm install
npm run build        # → DMG in dist/
```

**Dev mode** (no build needed):

```bash
cp .env.example .env  # add your API keys
npm start
```

## Configuration

Edit `config.json` to customize:

| Key | Default | Description |
|-----|---------|-------------|
| `soniox.model` | `stt-rt-v4` | Soniox STT model |
| `soniox.language_hints` | `["vi", "en"]` | Languages to detect |
| `llm.model` | `grok-4-fast-non-reasoning` | LLM model for correction |
| `voice.stop_word` | `thank you` | Phrase to stop recording |
| `voice.context_lines` | `100` | Terminal context lines sent to LLM |

## License

MIT
