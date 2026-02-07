"""Soniox WebSocket STT client — streams audio, returns transcript tokens."""

import asyncio
import json
import os

import websockets

SONIOX_WS_URL = "wss://stt-rt.soniox.com/transcribe-websocket"


class SonioxSTT:
    """Real-time speech-to-text via Soniox WebSocket.

    Protocol:
    1. Send JSON config FIRST (text frame)
    2. Then send binary audio ONLY (no more JSON!)
    """

    def __init__(self, api_key: str | None = None, model: str = "stt-rt-v4") -> None:
        self.api_key = api_key or os.environ.get("SONIOX_API_KEY", "")
        self.model = model
        self._ws = None
        self._transcript = ""

    async def connect(self) -> None:
        """Connect to Soniox and send config."""
        if not self.api_key:
            raise RuntimeError("SONIOX_API_KEY not set")

        self._ws = await websockets.connect(SONIOX_WS_URL)

        # CRITICAL: JSON config must be the FIRST message
        config = {
            "api_key": self.api_key,
            "model": self.model,
            "sample_rate": 16000,
            "num_channels": 1,
            "audio_format": "pcm_s16le",
            "language_hints": ["vi", "en"],
            "language_hints_strict": True,
        }
        await self._ws.send(json.dumps(config))

    async def send_audio(self, pcm_bytes: bytes) -> None:
        """Send binary audio chunk. Must call connect() first."""
        if self._ws is not None:
            await self._ws.send(pcm_bytes)

    async def receive_tokens(self, on_transcript=None):
        """Async generator yielding accumulated transcript.

        Args:
            on_transcript: Optional callback(transcript: str, is_final: bool)

        Yields:
            (transcript, has_final) tuples
        """
        async for message in self._ws:
            data = json.loads(message)

            if "error_message" in data:
                raise RuntimeError(f"Soniox error: {data['error_message']}")

            tokens = data.get("tokens", [])
            final_text = ""
            interim_text = ""

            for token in tokens:
                if token.get("is_final"):
                    final_text += token["text"]
                else:
                    interim_text += token["text"]

            if final_text:
                self._transcript += final_text

            full = self._transcript + interim_text
            has_final = bool(final_text)

            if on_transcript:
                on_transcript(full, has_final)

            yield self._transcript, has_final

    def reset_transcript(self) -> None:
        """Clear accumulated transcript (after command processed)."""
        self._transcript = ""

    @property
    def transcript(self) -> str:
        return self._transcript

    async def close(self) -> None:
        """Close WebSocket connection."""
        if self._ws is not None:
            await self._ws.close()
            self._ws = None
