# Architecture Details

## Module Interfaces

### audio.py
- Captures 16kHz mono PCM16 from mic via `sounddevice`
- Streams chunks of 4096 samples via callback
- Provides async iterator or callback interface for pipeline consumption

### stt.py (Soniox WebSocket)
- Endpoint: `wss://api.soniox.com/transcribe-websocket`
- Protocol: Send JSON config first, then binary audio frames
- Language hints: `["vi", "en"]` with `strict=true`
- Returns token stream, accumulates into transcript

### stopword.py
- Detects configurable stop phrase (default: "thank you") at end of transcript
- Handles variations: `. thank you`, `, thank you`, `! thank you`
- Strips trailing punctuation from extracted command
- Stateful: must reset after each detection

### llm.py (Grok/xAI)
- Uses langchain with xAI provider, temperature=0.1
- System prompt includes STT error correction mappings (e.g., "cloud code" → "Claude Code")
- Receives Kitty terminal context (last 50 lines) for disambiguation
- Preserves swear words (frustration signals intent)

### kitty.py
- `get_socket_path()` — reads `$KITTY_LISTEN_ON`
- `get_text(socket_path)` — captures current pane text
- `send_command(socket_path, text)` — `kitty @ send-text` + `kitty @ send-key Return`

### pipeline.py
1. Start mic capture → stream to Soniox
2. Accumulate transcript, check for stop word
3. On stop word: get Kitty pane context → LLM correction
4. Send corrected command to Kitty
5. Reset transcript, continue listening
