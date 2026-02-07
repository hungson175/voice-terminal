# Stop Word Detector

Detects stop words (e.g., "thank you") to finalize voice commands.

## Source File

`frontend/lib/stt/stopword-detector.ts`

## Purpose

Voice commands need a trigger to know when user is done speaking. Options:
1. **Silence detection** - Problematic (user pauses mid-sentence)
2. **Button press** - Not hands-free
3. **Stop word** - Natural ("thank you" signals command completion)

## Complete Implementation

```typescript
/**
 * StopWordDetector - Detects stop words to finalize voice commands
 *
 * When user says "check the logs thank you", detects "thank you"
 * and returns "check the logs" as the command.
 */

export interface StopWordDetectorConfig {
  stopWord?: string  // Default: "thank you"
}

export interface DetectionResult {
  detected: boolean
  command: string
}

export class StopWordDetector {
  private stopWord: string
  private stopWordLower: string
  private lastProcessedLength = 0

  constructor(config: Partial<StopWordDetectorConfig> = {}) {
    this.stopWord = config.stopWord || "thank you"
    this.stopWordLower = this.stopWord.toLowerCase()
  }

  /**
   * Process transcript and check for stop word
   *
   * @param transcript Current accumulated transcript
   * @returns Detection result with command (stop word stripped)
   */
  processTranscript(transcript: string): DetectionResult {
    const trimmed = transcript.trim()
    const lower = trimmed.toLowerCase()

    // Check if stop word appears at the end
    if (lower.endsWith(this.stopWordLower)) {
      // Extract command (everything before stop word)
      const commandEnd = trimmed.length - this.stopWord.length
      const command = trimmed.substring(0, commandEnd).trim()

      // Strip trailing punctuation
      const cleanCommand = command.replace(/[,.\s]+$/, "").trim()

      return {
        detected: true,
        command: cleanCommand,
      }
    }

    // Also check for variations (period, comma before stop word)
    const variations = [
      `. ${this.stopWordLower}`,
      `, ${this.stopWordLower}`,
      `! ${this.stopWordLower}`,
    ]

    for (const variation of variations) {
      if (lower.endsWith(variation)) {
        const commandEnd = trimmed.length - variation.length
        const command = trimmed.substring(0, commandEnd).trim()
        return {
          detected: true,
          command: command,
        }
      }
    }

    return {
      detected: false,
      command: "",
    }
  }

  /**
   * Reset detector state (after command processed)
   */
  reset(): void {
    this.lastProcessedLength = 0
  }

  /**
   * Get current stop word
   */
  getStopWord(): string {
    return this.stopWord
  }

  /**
   * Update stop word
   */
  setStopWord(stopWord: string): void {
    this.stopWord = stopWord
    this.stopWordLower = stopWord.toLowerCase()
  }
}
```

## Usage Example

```typescript
const detector = new StopWordDetector({ stopWord: "thank you" })

// Partial transcript - not detected
let result = detector.processTranscript("check the backend")
console.log(result)  // { detected: false, command: "" }

// Complete transcript with stop word
result = detector.processTranscript("check the backend thank you")
console.log(result)  // { detected: true, command: "check the backend" }

// Works with variations
result = detector.processTranscript("fix this bug, thank you")
console.log(result)  // { detected: true, command: "fix this bug" }

// Reset for next command
detector.reset()
```

## Alternative Stop Words

| Language | Stop Word | Notes |
|----------|-----------|-------|
| English | "thank you" | Natural, polite |
| English | "execute" | More technical |
| Vietnamese | "cảm ơn" | But mixed with English, may get transcribed oddly |

## Key Learnings

1. **"thank you" works best** - Natural phrase, rarely said mid-command
2. **Handle variations** - Users say "thank you.", "thank you,", etc.
3. **Case insensitive** - STT may return "Thank you" or "THANK YOU"
4. **Strip trailing punctuation** - Clean command output
