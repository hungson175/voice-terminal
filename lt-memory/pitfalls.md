# Pitfalls

Known gotchas and failure patterns discovered during development.

## Don't Build Backend Before UI
Started implementing Python pipeline modules (audio, stt, stopword, llm) before having any user-facing interface. User follows product-oriented development: build UI with mocked data first so the product is tangible, then wire real backend step by step.

## Soniox: Wrong WebSocket URL in PKM
PKM reference uses `wss://api.soniox.com/transcribe-websocket` — this is the OLD endpoint. The correct URL is `wss://stt-rt.soniox.com/transcribe-websocket`. The old endpoint rejects `language_hints` and `language_hints_strict` as unknown fields. Always check the production app at `AI-teams-controller` for the working config, not the PKM code samples.

## Soniox: translation_terms Format
`translation_terms` must be an array of `{source, target}` objects, NOT a plain key-value map. Wrong format causes "Start request is malformed" with no further detail.
Correct: `[{ source: "cross code", target: "Claude Code" }]`
Wrong: `{ "cross code": "Claude Code" }`

## Electron CSP: No Inline Scripts
`default-src 'self'` CSP silently blocks inline `<script>` tags — no error, just doesn't execute. Move all event handlers to external `.js` files loaded via `<script src>`.

## Kitty send-key Timing for Long Text
`kitty @ send-key Return` after `kitty @ send-text` with long text gets swallowed — the terminal app (Claude Code) is still processing the input buffer. Both commands succeed without error but Enter doesn't register. Fix: add 500ms delay before `send-key` when text > 200 chars.

## Kitty send-text: Use stdin for Long Commands
Pass text via `--stdin` flag and pipe through spawn's stdin instead of command-line argument. Avoids argument length limits and is more reliable for long text. Also use a dynamic timeout proportional to text length.

## Packaged App: safeStorage Identity Mismatch
Credentials encrypted by the packaged `.app` can't be decrypted by the dev `npm start` instance (different Electron app identity = different Keychain entry). Wrap `getCredentials()` in try/catch and fall back to `.env` on decryption failure.

## Packaged App: PATH Not Inherited
macOS Finder apps don't inherit shell PATH. `kitty` CLI won't be found unless PATH is explicitly extended with `/opt/homebrew/bin`, `/usr/local/bin`, `/Applications/kitty.app/Contents/MacOS` when `app.isPackaged`.

## Packaged App: Config Path
`config.json` is bundled as `extraResources` (outside asar). Use `process.resourcesPath` when packaged, `__dirname/..` in dev.

## First-Run Setup: Always Provide Key Reset
If API keys are wrong after first-run setup, users have no way to re-enter them unless you provide a "Reset API Keys" action in the main UI. Always include this escape hatch.
