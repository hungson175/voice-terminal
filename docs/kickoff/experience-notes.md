# Experience Notes: Vietnamese + English Voice Commands

Lessons learned from building production voice command system with mixed language support.

## Overview

**Use Case:** Voice commands to AI agents in tmux-based development environment
**Languages:** Vietnamese (primary) + English (technical terms)
**STT Provider:** Soniox Real-Time v4
**LLM Post-Processing:** Grok (xAI) for transcription correction

---

## Soniox Configuration for Vietnamese+English

### What Works

```json
{
  "language_hints": ["vi", "en"],
  "language_hints_strict": true
}
```

- **Order matters**: Put primary language first (vi)
- **strict=true**: Prevents random language switches
- **Bilingual mode**: Handles code-switching naturally

### What Doesn't Work

- Single language mode with mixed speech → poor accuracy
- Language auto-detect → unpredictable switches
- language_hints without strict → ignores hints

---

## STT Error Patterns

### Technical Terms (Most Common Errors)

| User Says | STT Returns | Pattern |
|-----------|-------------|---------|
| "Claude Code" | "cloud code", "cross code" | Product names |
| "tmux" | "tea mux", "TMAX" | Unix tools |
| "pytest" | "pie test" | Python tools |
| "GitHub" | "get hub" | Compound words |
| "LLM" | "L M", "elem" | Acronyms |
| "pnpm" | "pee npm" | Unusual pronunciations |

### Why These Happen

1. **Non-native accent** - Vietnamese speaker, English words
2. **Unusual words** - STT models trained on common speech
3. **Context confusion** - "cloud" more common than "Claude"

### Solution: LLM Post-Processing

Build correction map in system prompt:
```
"cross code" / "cloud code" → "Claude Code"
"tea mux" / "TMAX" → "tmux"
```

LLM uses tmux pane context to disambiguate.

---

## Stop Word Selection

### Winner: "thank you"

**Why it works:**
- Natural end phrase in English
- Clear pronunciation
- Rarely said mid-command
- Polite (good habit)

**Alternatives tried:**

| Stop Word | Problem |
|-----------|---------|
| "execute" | Too technical, weird to say |
| "send" | Common word, false triggers |
| "done" | Often said mid-sentence |
| "cảm ơn" | STT struggles with Vietnamese stop words when mixed with English |

### Implementation Tip

Handle variations:
- "thank you"
- "thank you."
- "thank you,"
- "Thank You"

---

## Mobile Browser Issues

### iOS AudioContext Suspension

**Problem:** iOS suspends AudioContext when:
- User switches apps
- Screen locks
- Tab goes to background

**Solution:**
```typescript
audioContext.onstatechange = () => {
  if (audioContext.state === "suspended") {
    // Show "Tap to resume" button
    showResumePrompt()
  }
}

// On user interaction
await audioContext.resume()
```

### Safari Microphone Permissions

**Problem:** Safari forgets permissions more aggressively

**Solution:** Always handle permission denied gracefully:
```typescript
try {
  await navigator.mediaDevices.getUserMedia({ audio: true })
} catch (error) {
  if (error.name === "NotAllowedError") {
    showPermissionInstructions()
  }
}
```

---

## WebSocket Connection Management

### Soniox Protocol Quirks

1. **JSON first, binary after** - Never send JSON after initial config
2. **No keepalive needed** - Soniox handles internally
3. **Clean close** - Always close WebSocket properly to prevent hanging

### Reconnection Strategy

```typescript
const RECONNECT_DELAYS = [1000, 2000, 5000]  // Exponential backoff

async function reconnect(attempt: number): Promise<void> {
  if (attempt >= RECONNECT_DELAYS.length) {
    showError("Connection failed. Please refresh.")
    return
  }

  await delay(RECONNECT_DELAYS[attempt])
  try {
    await connect()
  } catch {
    reconnect(attempt + 1)
  }
}
```

---

## LLM Correction Best Practices

### Context Window

Include last 50 lines of tmux pane content:
- Helps disambiguate commands
- Provides technical context
- Truncate to 2000 chars to limit tokens

### Temperature Setting

- **0.1** for command correction (deterministic)
- **0.3** for summaries (slightly creative)
- Never use high temperature for commands

### Preserve Frustration Signals

**Keep swear words!**

```
Input: "cái bug đéo gì mà lâu thế"
Output: "what the fuck is taking so long with this damn bug"
```

**Why:** Swearing indicates blockers/frustration → useful for retrospective analysis

---

## Performance Optimizations

### Audio Chunk Size

- **4096 samples** at 48kHz = ~85ms chunks
- Smaller = more network overhead
- Larger = more latency
- 4096 is sweet spot

### Transcript Debouncing

```typescript
const TRANSCRIPT_DEBOUNCE_MS = 100

// Debounce UI updates, not WebSocket messages
const debouncedUpdate = debounce((text) => {
  updateUI(text)
}, TRANSCRIPT_DEBOUNCE_MS)
```

### Clear Buffer Handling

After user clears transcript:
```typescript
this.lastClearTimestamp = Date.now()

// In message handler:
const timeSinceClear = Date.now() - this.lastClearTimestamp
if (timeSinceClear < 500) {
  // Ignore buffered messages from before clear
  return
}
```

---

## Production Checklist

- [ ] Handle microphone permission denial
- [ ] Handle WebSocket disconnection
- [ ] Handle iOS AudioContext suspension
- [ ] Implement transcript clear with buffer handling
- [ ] Add LLM correction with context
- [ ] Configure language hints correctly
- [ ] Test on mobile browsers
- [ ] Monitor Soniox usage/costs

---

## Metrics to Track

| Metric | Target | Why |
|--------|--------|-----|
| STT latency | < 500ms | Real-time feel |
| LLM correction latency | < 1s | Acceptable wait |
| Connection failures | < 1% | Reliability |
| Correction accuracy | > 95% | User trust |

---

## Future Improvements

1. **Custom STT model** - Train on project-specific terms
2. **Voice activity detection** - Better than stop words
3. **Speaker identification** - Multi-user support
4. **Local fallback** - Browser STT when offline
