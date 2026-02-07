# Voice Types and Utilities

TypeScript types and utility functions for voice command system.

## Source Files

- `frontend/lib/voice-types.ts`
- `frontend/lib/voice-utils.ts`
- `frontend/lib/voice-constants.ts`

## Audio Configuration

```typescript
/**
 * Audio configuration for voice capture
 */
export const AUDIO_CONFIG = {
  sampleRate: 16000,      // 16kHz for STT (Soniox, Whisper)
  channels: 1,            // Mono
  format: "pcm_s16le",    // 16-bit signed little-endian PCM
} as const

/**
 * Noise filter levels for VAD
 */
export type NoiseFilterLevel = "off" | "low" | "medium" | "high"

export const NOISE_FILTER_CONFIGS: Record<NoiseFilterLevel, { silenceThreshold: number, minSpeechDuration: number }> = {
  off: { silenceThreshold: -60, minSpeechDuration: 0 },
  low: { silenceThreshold: -50, minSpeechDuration: 100 },
  medium: { silenceThreshold: -40, minSpeechDuration: 200 },
  high: { silenceThreshold: -30, minSpeechDuration: 300 },
}
```

## Voice State Types

```typescript
/**
 * Voice input status
 */
export type VoiceStatus =
  | "idle"           // Not active
  | "connecting"     // Connecting to STT service
  | "listening"      // Actively listening for speech
  | "processing"     // Processing command (LLM correction)
  | "error"          // Error state

/**
 * Voice feedback modes
 */
export type VoiceFeedbackMode =
  | "voice"      // Full TTS voice feedback
  | "tone"       // Short audio tones only
  | "off"        // Silent (no audio feedback)
  | "team_name"  // Say team/role name only

/**
 * Complete voice state
 */
export interface VoiceState {
  status: VoiceStatus
  transcript: string        // Current transcript (interim + final)
  error: string | null
  isConnected: boolean
  feedbackMode: VoiceFeedbackMode
  noiseFilter: NoiseFilterLevel
}

/**
 * Voice command request to backend
 */
export interface VoiceCommandRequest {
  team_id: string
  role_id: string
  command: string
  use_correction?: boolean  // Enable LLM correction
}
```

## Utility Functions

```typescript
/**
 * Convert Float32 audio data to base64-encoded PCM16
 */
export function float32ToPcm16Base64(float32Data: Float32Array): string {
  // Convert to Int16
  const int16 = new Int16Array(float32Data.length)
  for (let i = 0; i < float32Data.length; i++) {
    const sample = Math.max(-1, Math.min(1, float32Data[i]))
    int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
  }

  // Convert to base64
  const bytes = new Uint8Array(int16.buffer)
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Convert base64 audio to Blob for playback
 */
export function base64ToAudioBlob(base64: string, mimeType: string = "audio/mp3"): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: mimeType })
}
```

## Voice Constants

```typescript
/**
 * Voice system constants
 */
export const VOICE_CONSTANTS = {
  // Debounce timing
  TRANSCRIPT_DEBOUNCE_MS: 100,    // Debounce transcript updates
  COMMAND_DEBOUNCE_MS: 500,       // Debounce command sending

  // Notifications
  NOTIFICATION_DURATION_MS: 3000,  // Toast notification duration

  // Deduplication
  DEDUP_WINDOW_MS: 5000,          // Ignore duplicate commands within window

  // Connection
  RECONNECT_DELAY_MS: 1000,       // Delay before reconnecting
  MAX_RECONNECT_ATTEMPTS: 3,      // Max reconnection attempts

  // Audio
  AUDIO_CHUNK_SIZE: 4096,         // Audio buffer size (samples)
} as const
```

## Type-Safe Event Handling

```typescript
/**
 * Voice event types for type-safe event handling
 */
export interface VoiceEvents {
  "transcript": { text: string; isFinal: boolean }
  "finalize": { command: string }
  "connection": { connected: boolean }
  "error": { error: Error }
  "audio-level": { levelDb: number }
  "state-change": { state: AudioContextState; resumed: boolean }
}

/**
 * Type-safe event emitter for voice events
 */
export type VoiceEventHandler<K extends keyof VoiceEvents> = (
  data: VoiceEvents[K]
) => void
```

## Key Learnings

1. **16kHz mono PCM** - Standard for speech recognition
2. **Noise filter configs** - Different environments need different thresholds
3. **Deduplication window** - Prevent double-sending commands
4. **Type-safe events** - TypeScript generics for event handling
