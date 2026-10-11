import re

from ....llm import ChatMessage
from ..errors import MalformedSuggestionError
from .create_suggestion_request import CreateSuggestionRequest

SYSTEM_PROMPT = """\
You are a careful co-author helping someone edit their Markdown document.

You get the full document for context. The passage to edit is wrapped in \
<selection> tags. Rewrite ONLY that passage, following the instruction.

Rules:
- Return only the new version of the selected passage, never the whole document.
- Keep the author's voice, language and Markdown formatting unless the instruction says otherwise.
- Keep it consistent with the text around it (terms, tense, headings).
- If the passage is already good, return it unchanged and say so in the reason.

Answer in exactly this format and nothing else:
<replacement>
the rewritten passage
</replacement>
<reason>one short sentence on what you changed and why</reason>"""

# A block may not contain its own opening tag, so a stray "<replacement>" in
# the model's drafting can't swallow the text up to a later, complete block.
_REPLACEMENT_PATTERN = re.compile(r"<replacement>((?:(?!<replacement>).)*?)</replacement>", re.DOTALL)
_REASON_PATTERN = re.compile(r"<reason>((?:(?!<reason>).)*?)</reason>", re.DOTALL)


def build_messages(request: CreateSuggestionRequest) -> list[ChatMessage]:
    """System prompt, the document with the marked selection, then each refine round."""

    document = f"{request.before}<selection>{request.selection}</selection>{request.after}"
    instructions = [turn.instruction for turn in request.turns] + [request.instruction]

    messages: list[ChatMessage] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": f"Document:\n\n{document}\n\nInstruction: {instructions[0]}",
        },
    ]
    for turn, next_instruction in zip(request.turns, instructions[1:]):
        messages.append(
            {"role": "assistant", "content": f"<replacement>\n{turn.replacement}\n</replacement>"}
        )
        messages.append(
            {
                "role": "user",
                "content": f"Revise your last replacement. Instruction: {next_instruction}",
            }
        )
    return messages


def _strip_one_newline(text: str) -> str:
    """Drop the single newline the format puts after/before the tags, keep the rest."""

    return text.removeprefix("\n").removesuffix("\n")


def parse_completion(text: str) -> tuple[str, str | None]:
    """Extract (replacement, reason) from the tagged model answer.

    Takes the last block of each: a reasoning model may draft the format
    (e.g. inside <think>) before it gives its final answer.
    """

    # The editor stores every line break as "\n"; a "\r\n" would throw off the
    # positions it computes from the replacement's length.
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    replacements = _REPLACEMENT_PATTERN.findall(text)
    if not replacements:
        raise MalformedSuggestionError(
            "The model did not answer in the expected format. Try again or pick another model."
        )
    reasons = _REASON_PATTERN.findall(text)
    reason = reasons[-1].strip() if reasons else None
    return _strip_one_newline(replacements[-1]), reason or None
