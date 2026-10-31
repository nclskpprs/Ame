/**
 * Keyboard shortcuts written as `Mod+Shift+F`. `Mod` is Cmd on macOS and Ctrl
 * elsewhere. Letters and digits are matched by physical key (`event.code`)
 * so that Shift and keyboard layouts do not change the result.
 */

export interface Shortcut {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

export const isMac: boolean =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function parseShortcut(text: string): Shortcut {
  const parts = text.split('+');
  const key = parts.pop();
  if (!key) throw new Error(`invalid shortcut: ${text}`);
  return {
    mod: parts.includes('Mod'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key,
  };
}

function codeFor(key: string): string | null {
  if (/^[A-Z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return null;
}

type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'
>;

export function matchesShortcut(event: KeyEventLike, shortcut: Shortcut, mac = isMac): boolean {
  const mod = mac ? event.metaKey : event.ctrlKey;
  const otherMod = mac ? event.ctrlKey : event.metaKey;
  if (mod !== shortcut.mod || otherMod) return false;
  if (event.shiftKey !== shortcut.shift || event.altKey !== shortcut.alt) return false;
  const code = codeFor(shortcut.key);
  return code ? event.code === code : event.key.toLowerCase() === shortcut.key.toLowerCase();
}

/** Human-readable form, e.g. `⌘⇧F` on macOS and `Ctrl+Shift+F` elsewhere. */
export function formatShortcut(shortcut: Shortcut, mac = isMac): string {
  const key = shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key;
  if (mac) {
    return `${shortcut.alt ? '⌥' : ''}${shortcut.shift ? '⇧' : ''}${shortcut.mod ? '⌘' : ''}${key}`;
  }
  return [shortcut.mod && 'Ctrl', shortcut.alt && 'Alt', shortcut.shift && 'Shift', key]
    .filter(Boolean)
    .join('+');
}
