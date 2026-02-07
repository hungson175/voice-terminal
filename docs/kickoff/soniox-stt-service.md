# Soniox STT Service

WebSocket-based real-time speech-to-text service using Soniox API.

## Source File

`frontend/lib/stt/soniox-service.ts`

## Critical Protocol

Soniox WebSocket requires:
1. **Send JSON config FIRST** (text frame)
2. **Then send binary audio** (binary frames only)
3. **No JSON after config** - binary only!

## Configuration

```typescript
interface SonioxConfig {
  api_key: string
  model: string              // "stt-rt-v4" (latest)
  sample_rate: number        // 16000 Hz
  num_channels: number       // 1 (mono)
  audio_format: string       // "pcm_s16le"
  language_hints?: string[]  // ["vi", "en"] for Vietnamese+English
  language_hints_strict?: boolean  // true for strict language detection
}
```

## Complete Implementation

```typescript
/**
 * Soniox STT Service - WebSocket-based Speech-to-Text
 *
 * Connects to Soniox WebSocket API for real-time transcription.
 * Uses stop-word-based detection to finalize commands.
 *
 * CRITICAL: Soniox protocol requires:
 * 1. Send JSON config message FIRST (text frame)
 * 2. Then send binary audio chunks (binary frames)
 */

import { StopWordDetector } from "./stopword-detector"
import { AudioCapture } from "./audio-capture"

const SONIOX_WS_URL = "wss://api.soniox.com/transcribe-websocket"

/**
 * Soniox token from single word
 */
interface SonioxToken {
  text: string
  is_final: boolean
  start_ms?: number
  duration_ms?: number
  confidence?: number
}

/**
 * Soniox WebSocket response
 */
interface SonioxResponse {
  tokens?: SonioxToken[]
  error_message?: string
}

/**
 * Service configuration
 */
export interface SonioxServiceConfig {
  detectionMode: "stopword"
  model?: string           // default: "stt-rt-v4"
  stopWord?: string        // default: "thank you"
}

/**
 * Event callbacks
 */
export interface SonioxServiceCallbacks {
  onTranscript?: (transcript: string, isFinal: boolean) => void
  onFinalize?: (command: string) => void
  onConnectionChange?: (connected: boolean) => void
  onError?: (error: Error) => void
  onAudioLevel?: (levelDb: number) => void
  onAudioStateChange?: (state: AudioContextState, resumed: boolean) => void
}

export class SonioxSTTService {
  private config: Required<SonioxServiceConfig>
  private callbacks: SonioxServiceCallbacks
  private websocket: WebSocket | null = null
  private audioCapture: AudioCapture | null = null
  private stopWordDetector: StopWordDetector
  private isConnected = false
  private transcript = ""
  private apiKey: string | null = null
  private lastClearTimestamp = 0

  constructor(
    config: Partial<SonioxServiceConfig> = {},
    callbacks: SonioxServiceCallbacks = {}
  ) {
    this.config = {
      detectionMode: "stopword",
      model: "stt-rt-v4",
      stopWord: "thank you",
      ...config
    }
    this.callbacks = callbacks
    this.stopWordDetector = new StopWordDetector({
      stopWord: this.config.stopWord,
    })
  }

  /**
   * Connect to Soniox WebSocket and start audio capture
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      throw new Error("Already connected")
    }

    try {
      // Get API key from backend
      this.apiKey = await this.fetchApiKey()

      // Connect to WebSocket
      this.websocket = new WebSocket(SONIOX_WS_URL)

      // Wait for WebSocket to open
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("WebSocket connection timeout"))
        }, 10000)

        this.websocket!.onopen = () => {
          clearTimeout(timeout)
          resolve()
        }

        this.websocket!.onerror = () => {
          clearTimeout(timeout)
          reject(new Error("WebSocket connection failed"))
        }
      })

      // CRITICAL: Send config as FIRST message (JSON text frame)
      const config = {
        api_key: this.apiKey,
        model: this.config.model,
        sample_rate: 16000,
        num_channels: 1,
        audio_format: "pcm_s16le",
        language_hints: ["vi", "en"],      // Vietnamese + English
        language_hints_strict: true,
      }
      this.websocket.send(JSON.stringify(config))

      // Set up message handler
      this.websocket.onmessage = this.handleMessage.bind(this)
      this.websocket.onerror = () => this.callbacks.onError?.(new Error("WebSocket error"))
      this.websocket.onclose = () => {
        this.isConnected = false
        this.callbacks.onConnectionChange?.(false)
      }

      // Start audio capture
      this.audioCapture = new AudioCapture({ sampleRate: 16000 })
      this.audioCapture.setStateCallback((state, resumed) => {
        this.callbacks.onAudioStateChange?.(state, resumed)
      })
      await this.audioCapture.start(this.handleAudioChunk.bind(this))

      this.isConnected = true
      this.transcript = ""
      this.callbacks.onConnectionChange?.(true)
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data: SonioxResponse = JSON.parse(event.data)

      if (data.error_message) {
        this.callbacks.onError?.(new Error(data.error_message))
        return
      }

      if (data.tokens) {
        let finalText = ""
        let interimText = ""

        for (const token of data.tokens) {
          if (token.is_final) {
            finalText += token.text
          } else {
            interimText += token.text
          }
        }

        // Ignore buffered messages after clear (500ms window)
        const timeSinceClear = Date.now() - this.lastClearTimestamp
        const shouldIgnoreBuffered = timeSinceClear < 500

        if (finalText && !shouldIgnoreBuffered) {
          this.transcript += finalText
        }

        // Emit transcript update
        const fullTranscript = this.transcript + interimText
        this.callbacks.onTranscript?.(fullTranscript, finalText.length > 0 && !shouldIgnoreBuffered)

        // Check for stop word
        const result = this.stopWordDetector.processTranscript(this.transcript)
        if (result.detected) {
          this.handleFinalize(result.command)
        }
      }
    } catch (error) {
      console.error("Message parse error:", error)
    }
  }

  /**
   * Handle audio chunk - send binary to WebSocket
   */
  private handleAudioChunk(float32Data: Float32Array, int16Data: Int16Array): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(int16Data.buffer)  // Binary frame!
    }
  }

  /**
   * Handle command finalization
   */
  private handleFinalize(command: string): void {
    this.callbacks.onFinalize?.(command)
    this.transcript = ""  // Reset for next command
  }

  /**
   * Reset transcript (for clear button)
   */
  resetTranscript(): void {
    this.transcript = ""
    this.lastClearTimestamp = Date.now()
    this.stopWordDetector.reset()
    this.callbacks.onTranscript?.("", false)
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    this.cleanup()
  }

  private cleanup(): void {
    this.isConnected = false
    if (this.audioCapture) {
      this.audioCapture.stop()
      this.audioCapture = null
    }
    if (this.websocket) {
      this.websocket.close()
      this.websocket = null
    }
    this.callbacks.onConnectionChange?.(false)
  }

  private async fetchApiKey(): Promise<string> {
    const response = await fetch(`/api/voice/token/soniox`, {
      method: "POST",
      headers: { /* auth headers */ },
    })
    if (!response.ok) {
      throw new Error(`Failed to get Soniox token: ${response.status}`)
    }
    const data = await response.json()
    return data.api_key
  }
}
```

## Usage Example

```typescript
const stt = new SonioxSTTService(
  { stopWord: "thank you" },
  {
    onTranscript: (text, isFinal) => {
      console.log(isFinal ? `FINAL: ${text}` : `INTERIM: ${text}`)
    },
    onFinalize: (command) => {
      console.log("Command ready:", command)
      // Send to LLM for correction, then to agent
    },
    onConnectionChange: (connected) => {
      console.log("STT connected:", connected)
    },
  }
)

await stt.connect()
// Microphone streaming starts automatically
// Say "check the backend logs thank you" → onFinalize fires
```

## Key Learnings

1. **Binary-only after config** - Soniox crashes if you send JSON pings after initial config
2. **Keepalive not needed** - Soniox handles connection internally (unlike Cloudflare tunnels)
3. **Clear buffer handling** - Track `lastClearTimestamp` to ignore buffered tokens after user clears
4. **Mobile AudioContext** - iOS suspends AudioContext; handle resume in callbacks
