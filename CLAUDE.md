# CLAUDE.md

## Commands
```bash
npm install                                      # Install Electron dependencies
npm start                                        # Run the menubar app
uv sync                                          # Install Python dependencies
uv run pytest                                    # Run all tests
uv run pytest tests/test_kitty.py -v             # Single test file
```

## Architecture
Voice Terminal: macOS menubar app for voice-to-terminal commands (Vietnamese+English mix).

**Pipeline:** Mic (Web Audio API) → Soniox WebSocket → STT tokens → Stop word detection → LLM correction (Grok/xAI) → kitty @ send-text

**Electron app** (primary):
- `electron/main.js` — Main process: tray, IPC, loads config.json + .env
- `electron/preload.js` — Context bridge for renderer
- `electron/kitty-service.js` — Auto-detect Kitty windows via `/tmp/mykitty-*` sockets
- `electron/llm-service.js` — xAI API for transcript correction
- `ui/stt.js` — Soniox WebSocket STT client (runs in renderer)
- `ui/stopword.js` — Stop word detector
- `ui/renderer.js` — UI logic, wires STT → stopword → LLM → Kitty
- `ui/index.html` + `ui/styles.css` — Menubar popup UI

**Python backend** (modules for future CLI mode):
- `src/voice_terminal/kitty.py`, `audio.py`, `stt.py`, `stopword.py`, `llm.py`

**Config:** `config.json` — all service URLs, models, and settings. Never hardcode these values.

## Key Conventions
- **UI-first development**: Build UI with mocked data first (v1.0), then wire backend incrementally
- **Configuration as code**: All URLs, models, thresholds in `config.json`. Secrets in `.env`.
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
