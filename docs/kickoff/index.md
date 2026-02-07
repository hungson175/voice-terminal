# Voice Command Code Samples

Voice-to-command system from AI-teams-controller project. Full production implementation with Vietnamese+English support.

## Architecture Overview

```
[Microphone] → [Audio Capture] → [Soniox WebSocket] → [STT Tokens]
                                                           ↓
[Command Output] ← [LLM Post-Processing] ← [Stop Word Detection]
```

## Files in This Collection

| File | Description |
|------|-------------|
| [[soniox-stt-service]] | Main Soniox STT WebSocket service |
| [[audio-capture]] | Microphone audio capture with Web Audio API |
| [[stopword-detector]] | Stop word detection for command finalization |
| [[llm-voice-correction]] | LLM post-processing for transcription correction |
| [[voice-types-and-utils]] | TypeScript types and utility functions |
| [[experience-notes]] | Lessons learned with Vietnamese+English voice input |

## Key Technologies

- **Soniox STT v4** - Real-time speech-to-text (WebSocket)
- **Web Audio API** - Browser microphone capture
- **Grok LLM (xAI)** - Voice transcription correction
- **LangChain** - Structured LLM output

## Quick Start

1. Get Soniox API key from backend
2. Connect WebSocket to `wss://api.soniox.com/transcribe-websocket`
3. Send JSON config first (text frame)
4. Stream PCM audio (binary frames)
5. Process tokens, detect stop word
6. Send to LLM for correction

## Source Project

- **Project:** AI-teams-controller
- **Path:** `frontend/lib/stt/` and `backend/app/services/`
- **Date:** 2026-02-07
