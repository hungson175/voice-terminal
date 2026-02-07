# Pitfalls

Known gotchas and failure patterns discovered during development.

<!-- Add entries as they're discovered. Format:
## Short Title
What went wrong and the correct approach. Keep it actionable.
-->

## Don't Build Backend Before UI
Started implementing Python pipeline modules (audio, stt, stopword, llm) before having any user-facing interface. User follows product-oriented development: build UI with mocked data first so the product is tangible, then wire real backend step by step.

## Soniox: Wrong WebSocket URL in PKM
PKM reference uses `wss://api.soniox.com/transcribe-websocket` — this is the OLD endpoint. The correct URL is `wss://stt-rt.soniox.com/transcribe-websocket`. The old endpoint rejects `language_hints` and `language_hints_strict` as unknown fields. Always check the production app at `AI-teams-controller` for the working config, not the PKM code samples.
