/**
 * What Shift+Enter sends: Escape + carriage return, the same as Alt+Enter
 * in a terminal with "Option as Meta". Agents such as Claude Code, Codex
 * and Gemini CLI insert a line break for it instead of submitting.
 */
export const NEWLINE_SEQUENCE = '\x1b\r';

/** Shift+Enter without other modifiers. */
export function isNewlineKey(
  event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>,
): boolean {
  return (
    event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey
  );
}
