# Whiteboard

Current sprint work, decisions, and notes.

## Current Sprint: 2 — Wire Real Kitty Integration

### In Progress
<!-- Move items here when actively working on them -->

### Decisions
- **UI-first approach**: Built full Electron menubar UI with mocked data first (Sprint 1), now wiring real backend incrementally
- **Architecture**: Electron menubar app (macOS) + Python backend modules. Communication TBD (subprocess stdio vs local HTTP/WebSocket)
- **Python modules pre-written**: kitty.py, audio.py, stt.py, stopword.py, llm.py — need to wire to Electron

### Notes
- Sprint 1 completed: menubar popup with mic toggle, simulated transcript (word-by-word), mock Kitty terminal list, mock LLM correction, send button
- Tray icon changes between idle (black) and active (red) based on mic state
- PKM reference code copied to `docs/kickoff/`
