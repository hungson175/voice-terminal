"""Mic capture via sounddevice — 16kHz mono PCM16, 4096-sample chunks."""

import asyncio
import struct

import sounddevice as sd


SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 4096  # samples per chunk
DTYPE = "int16"


class AudioCapture:
    """Captures microphone audio and pushes PCM16 bytes to an async queue."""

    def __init__(self) -> None:
        self._queue: asyncio.Queue[bytes] = asyncio.Queue()
        self._stream: sd.RawInputStream | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def _callback(self, indata: bytes, frames: int, time_info, status) -> None:
        """sounddevice callback — runs in audio thread, pushes to asyncio queue."""
        if status:
            print(f"[audio] {status}")
        if self._loop is not None:
            self._loop.call_soon_threadsafe(self._queue.put_nowait, bytes(indata))

    def start(self) -> None:
        """Open mic stream."""
        self._loop = asyncio.get_running_loop()
        self._stream = sd.RawInputStream(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            dtype=DTYPE,
            blocksize=CHUNK_SIZE,
            callback=self._callback,
        )
        self._stream.start()

    def stop(self) -> None:
        """Close mic stream."""
        if self._stream is not None:
            self._stream.stop()
            self._stream.close()
            self._stream = None

    async def chunks(self):
        """Async generator yielding PCM16 bytes chunks."""
        while True:
            chunk = await self._queue.get()
            yield chunk
