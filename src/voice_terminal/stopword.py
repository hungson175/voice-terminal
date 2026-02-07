"""Stop word detector — detects 'thank you' (or custom) at end of transcript."""

import re
from dataclasses import dataclass


@dataclass
class DetectionResult:
    detected: bool
    command: str


class StopWordDetector:
    """Detects a stop phrase at the end of a transcript.

    Handles variations like ". thank you", ", thank you", "! thank you".
    """

    def __init__(self, stop_word: str = "thank you") -> None:
        self.stop_word = stop_word
        self._stop_lower = stop_word.lower()

    def process(self, transcript: str) -> DetectionResult:
        """Check if transcript ends with stop word.

        Returns DetectionResult with detected=True and the clean command
        (stop word and trailing punctuation stripped).
        """
        trimmed = transcript.strip()
        lower = trimmed.lower()

        # Direct match at end
        if lower.endswith(self._stop_lower):
            command = trimmed[: len(trimmed) - len(self.stop_word)].strip()
            command = re.sub(r"[,.\s]+$", "", command)
            return DetectionResult(detected=True, command=command)

        # Variations with punctuation before stop word
        for sep in [". ", ", ", "! "]:
            variation = sep + self._stop_lower
            if lower.endswith(variation):
                command = trimmed[: len(trimmed) - len(variation)].strip()
                return DetectionResult(detected=True, command=command)

        return DetectionResult(detected=False, command="")
