# LLM Voice Correction

Uses LLM to correct STT transcription errors and translate Vietnamese to English.

## Source File

`backend/app/services/commands/processor.py`

## Purpose

Voice transcription has errors:
1. **Pronunciation errors** - "cloud code" instead of "Claude Code"
2. **Mixed language** - Vietnamese with English technical terms
3. **Context-dependent** - Same sound, different meaning based on context

LLM post-processing fixes these issues using context from the active tmux pane.

## System Prompt

```python
VOICE_2_COMMAND_SYSTEM_PROMPT = """You are a voice transcription corrector. Fix misheard words and translate to natural English.

## User Speech Pattern
User speaks mixed Vietnamese/English. Main language is Vietnamese, but technical terms (components, UI, API, functions, etc.) are in English.

## CRITICAL RULES
1. **Translate MEANING, not word-by-word** - output natural, fluent English
2. **Preserve all IDEAS and POINTS** - don't drop any information the user intended to convey
3. **Merge repetitions** - if user repeats the same idea multiple times, say it once clearly
4. **Remove fillers** - drop "uh", "um", "à", "ờ", "ừ", false starts, and self-corrections
5. **Clean up rambling** - if user circles back to restate something, keep the clearest version
6. **PRESERVE ALL SWEAR WORDS** - keep profanity/swearing intact (fuck, shit, stupid, damn, bitch, etc.). Swearing = frustration signal for retrospective analysis. Translate Vietnamese profanity to equivalent English swear words

## Fix These STT Errors
- "cross code" / "cloud code" / "cloth code" → "Claude Code"
- "tea mux" / "tee mux" / "T mux" / "TMAX" → "tmux"
- "tm send" / "T M send" / "team send" → "tm-send"
- "L M" / "L.M." / "elem" → "LLM"
- "A.P.I" / "a p i" → "API"
- "get hub" / "git hub" → "GitHub"
- "pie test" / "pi test" → "pytest"
- "you v" / "UV" → "uv"
- "pee npm" / "P NPM" → "pnpm"
- "salary" / "seller e" / "celery" → "Celery"

## Examples
Input: "cross code help me fix this bug in the backend folder please"
Output: Claude Code help me fix this bug in the backend folder please

Input: "chạy pie test cho folder backend đi, rồi check xem có lỗi gì không"
Output: Run pytest for the backend folder, then check if there are any errors

Input: "cái prompt đang bị dịch từng từ một, ngu quá, phải dịch nghĩa chứ"
Output: The prompt is translating word-by-word, that's stupid, it should translate the meaning instead

## Output
Return natural English that conveys the full meaning. No explanations.
"""
```

## Implementation

```python
from langchain.chat_models import init_chat_model
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field


class RoutedCommand(BaseModel):
    """Structured output for voice command correction."""
    corrected_command: str = Field(
        description="The cleaned/corrected command in English only"
    )
    is_backlog_task: bool = Field(
        description="True ONLY for WRITE operations on backlog (create/update/delete)"
    )


def correct_voice_command(voice_transcript: str, tmux_context: str) -> RoutedCommand:
    """Use LLM to correct pronunciation errors and determine routing.

    Args:
        voice_transcript: Raw transcript from voice input (may have errors)
        tmux_context: Current tmux pane content for context

    Returns:
        RoutedCommand with corrected_command and is_backlog_task
    """
    # Use Grok (xAI) for fast inference
    llm = init_chat_model(
        "grok-3-fast",          # Fast model for real-time
        model_provider="xai",
        temperature=0.1,        # Low temp for deterministic correction
    )
    structured_llm = llm.with_structured_output(RoutedCommand)

    # Build user message with context
    user_content = f"""## Tmux Pane Context (last 50 lines):
```
{tmux_context[-2000:]}
```

## Voice Transcript (may have pronunciation errors):
"{voice_transcript}"
"""

    messages = [
        SystemMessage(content=VOICE_2_COMMAND_SYSTEM_PROMPT),
        HumanMessage(content=user_content),
    ]

    response = structured_llm.invoke(messages)
    return response
```

## Usage Flow

```
1. User speaks: "cross code kiểm tra cái backend folder xem có bug gì không"
2. Soniox STT returns: "cross code kiểm tra cái backend folder xem có bug gì không"
3. Stop word detected, command extracted
4. LLM corrects: "Claude Code check the backend folder for any bugs"
5. Corrected command sent to active agent
```

## Key Learnings

1. **Context is crucial** - Tmux pane content helps LLM understand intent
2. **Low temperature** - Use 0.1 for deterministic corrections
3. **Structured output** - Pydantic models ensure consistent response format
4. **Preserve frustration signals** - Swear words indicate bugs/blockers for retrospective
5. **Meaning over words** - Vietnamese→English should translate intent, not literal words

## Common STT Errors by Frequency

| Misheard | Correct | Frequency |
|----------|---------|-----------|
| cloud/cross/cloth code | Claude Code | Very high |
| tea mux / TMAX | tmux | High |
| pie test | pytest | High |
| get hub | GitHub | Medium |
| salary/celery | Celery | Medium |
| elem / L M | LLM | Medium |
