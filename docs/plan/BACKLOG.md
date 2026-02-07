# Backlog

## Sprint 1: Electron Menubar UI (Mocked) ✅
**Status:** Done
**Deliverable:** macOS menubar app with mic toggle, transcript, terminal selector — all mocked data.

- [x] `package.json` + Electron + menubar setup
- [x] `electron/main.js` — main process, tray icon, IPC handlers
- [x] `electron/preload.js` — context bridge for renderer
- [x] `ui/index.html` + `ui/styles.css` — menubar popup UI
- [x] `ui/renderer.js` — mock interactions (simulated transcript, correction, send)
- [x] Tray icons: idle (black) + active (red)

## Sprint 2: Wire Real Kitty Integration
**Status:** Pending
**Deliverable:** Auto-detect Kitty windows, send real commands.

- [ ] Replace mock `list-terminals` with real `kitty @ ls` detection
- [ ] Replace mock `send-command` with real `kitty @ send-text` + `kitty @ send-key Return`
- [ ] Read terminal context via `kitty @ get-text`
- [ ] Python modules already written: `src/voice_terminal/kitty.py`

## Sprint 3: Wire Real STT (Soniox)
**Status:** Pending
**Deliverable:** Real mic capture → live transcript in UI.

- [ ] Connect audio capture to Soniox WebSocket (Python backend or Node.js)
- [ ] Stream real transcript tokens to Electron renderer
- [ ] Stop word detection triggers command finalization
- [ ] Python modules already written: `audio.py`, `stt.py`, `stopword.py`

## Sprint 4: Wire Real LLM Correction
**Status:** Pending
**Deliverable:** Raw transcript → corrected command via Grok.

- [ ] Connect LLM correction (Grok/xAI) to pipeline
- [ ] Send terminal context for disambiguation
- [ ] Display corrected command in UI
- [ ] Python module already written: `llm.py`

## Sprint 5: Full Pipeline + Polish
**Status:** Pending
**Deliverable:** Complete voice → Kitty flow working end-to-end.

- [ ] Wire full pipeline: mic → STT → stop word → LLM → Kitty
- [ ] Error handling and reconnection
- [ ] Settings (custom stop word, toggle correction)
- [ ] Auto-send option (skip manual "Send" button click)
