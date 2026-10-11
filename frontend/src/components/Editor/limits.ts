/**
 * Request size limits, mirroring the backend's CreateSuggestionRequest. JS
 * counts UTF-16 units and Python code points, so checking here is on the safe
 * side: a string within these limits is always within the backend's.
 */
export const MAX_SELECTION_CHARS = 20_000;
/** Context sent on each side of the selection; the rest is trimmed. */
export const MAX_CONTEXT_CHARS = 100_000;
export const MAX_INSTRUCTION_CHARS = 1_000;
