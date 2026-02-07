# Audio Capture

Browser microphone capture using Web Audio API with PCM output.

## Source File

`frontend/lib/stt/audio-capture.ts`

## Key Features

- **16kHz resampling** - Soniox requires 16kHz, browser gives 48kHz
- **Float32 → Int16 conversion** - For PCM binary streaming
- **Mobile AudioContext handling** - iOS suspends AudioContext on background
- **Chunk-based streaming** - 4096 sample chunks

## Complete Implementation

```typescript
/**
 * AudioCapture - Browser microphone capture for STT
 *
 * Captures audio from microphone, resamples to 16kHz,
 * and converts to Int16 PCM for Soniox streaming.
 */

export interface AudioCaptureConfig {
  sampleRate?: number  // Target sample rate (default: 16000)
}

export type AudioChunkCallback = (
  float32Data: Float32Array,
  int16Data: Int16Array
) => void

export type AudioStateCallback = (
  state: AudioContextState,
  resumed: boolean
) => void

export class AudioCapture {
  private config: Required<AudioCaptureConfig>
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private scriptProcessor: ScriptProcessorNode | null = null
  private sourceNode: MediaStreamAudioSourceNode | null = null
  private chunkCallback: AudioChunkCallback | null = null
  private stateCallback: AudioStateCallback | null = null
  private isRunning = false

  constructor(config: Partial<AudioCaptureConfig> = {}) {
    this.config = {
      sampleRate: 16000,
      ...config,
    }
  }

  /**
   * Start audio capture
   */
  async start(callback: AudioChunkCallback): Promise<void> {
    if (this.isRunning) {
      throw new Error("Audio capture already running")
    }

    this.chunkCallback = callback

    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      // Create AudioContext (browser gives native sample rate, usually 48kHz)
      this.audioContext = new AudioContext()

      // Handle iOS AudioContext suspension
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume()
      }

      // Monitor state changes (mobile background/foreground)
      this.audioContext.onstatechange = () => {
        const state = this.audioContext?.state
        if (state) {
          this.stateCallback?.(state, false)
        }
      }

      // Create nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream)

      // ScriptProcessor for raw audio access (deprecated but reliable)
      // bufferSize=4096 gives ~85ms chunks at 48kHz
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1)

      // Process audio chunks
      this.scriptProcessor.onaudioprocess = (event) => {
        const inputData = event.inputBuffer.getChannelData(0)

        // Resample from native rate to target rate (e.g., 48kHz → 16kHz)
        const resampledFloat32 = this.resample(
          inputData,
          this.audioContext!.sampleRate,
          this.config.sampleRate
        )

        // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
        const int16Data = this.float32ToInt16(resampledFloat32)

        // Send to callback
        this.chunkCallback?.(resampledFloat32, int16Data)
      }

      // Connect: microphone → processor → destination (required for processing)
      this.sourceNode.connect(this.scriptProcessor)
      this.scriptProcessor.connect(this.audioContext.destination)

      this.isRunning = true
    } catch (error) {
      this.cleanup()
      throw error
    }
  }

  /**
   * Stop audio capture
   */
  stop(): void {
    this.cleanup()
  }

  /**
   * Set callback for AudioContext state changes
   */
  setStateCallback(callback: AudioStateCallback): void {
    this.stateCallback = callback
  }

  /**
   * Resume AudioContext (for mobile background recovery)
   */
  async resume(): Promise<boolean> {
    if (this.audioContext && this.audioContext.state === "suspended") {
      await this.audioContext.resume()
      this.stateCallback?.(this.audioContext.state, true)
      return true
    }
    return false
  }

  /**
   * Resample audio from source rate to target rate
   * Simple linear interpolation (good enough for speech)
   */
  private resample(
    input: Float32Array,
    sourceRate: number,
    targetRate: number
  ): Float32Array {
    if (sourceRate === targetRate) {
      return input
    }

    const ratio = sourceRate / targetRate
    const outputLength = Math.floor(input.length / ratio)
    const output = new Float32Array(outputLength)

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio
      const srcIndexFloor = Math.floor(srcIndex)
      const srcIndexCeil = Math.min(srcIndexFloor + 1, input.length - 1)
      const fraction = srcIndex - srcIndexFloor

      // Linear interpolation
      output[i] = input[srcIndexFloor] * (1 - fraction) + input[srcIndexCeil] * fraction
    }

    return output
  }

  /**
   * Convert Float32 audio [-1, 1] to Int16 PCM [-32768, 32767]
   */
  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length)
    for (let i = 0; i < float32.length; i++) {
      // Clamp to [-1, 1] and scale to Int16 range
      const sample = Math.max(-1, Math.min(1, float32[i]))
      int16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff
    }
    return int16
  }

  private cleanup(): void {
    this.isRunning = false
    this.chunkCallback = null

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect()
      this.scriptProcessor = null
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect()
      this.sourceNode = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }
  }
}
```

## Usage Example

```typescript
const capture = new AudioCapture({ sampleRate: 16000 })

capture.setStateCallback((state, resumed) => {
  console.log(`AudioContext: ${state}, resumed: ${resumed}`)
})

await capture.start((float32, int16) => {
  // Send int16.buffer (ArrayBuffer) to WebSocket
  websocket.send(int16.buffer)
})

// Later...
capture.stop()
```

## Key Learnings

1. **ScriptProcessor deprecated but works** - AudioWorklet is newer but ScriptProcessor simpler for this use case
2. **Must connect to destination** - Even if you don't want audio output, ScriptProcessor requires destination connection
3. **Resample before sending** - Browser gives 48kHz, Soniox wants 16kHz
4. **iOS background suspension** - AudioContext suspends when app backgrounds; monitor and resume
