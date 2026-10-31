/**
 * Splits a command line typed in the settings into arguments: whitespace
 * separates, single or double quotes keep spaces, a backslash escapes the
 * next character outside single quotes.
 */
export function splitArgs(text: string): string[] {
  const args: string[] = [];
  let current = '';
  let started = false;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < text.length; i++) {
    const char = text[i] ?? '';
    if (quote) {
      if (char === quote) quote = null;
      else if (char === '\\' && quote === '"' && i + 1 < text.length) current += text[++i];
      else current += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (char === '\\' && i + 1 < text.length) {
      current += text[++i];
      started = true;
    } else if (/\s/.test(char)) {
      if (started) args.push(current);
      current = '';
      started = false;
    } else {
      current += char;
      started = true;
    }
  }
  if (started) args.push(current);
  return args;
}

/** The reverse of `splitArgs`: quotes arguments that need it. */
export function joinArgs(args: readonly string[]): string {
  return args
    .map((arg) =>
      arg === '' || /[\s"'\\]/.test(arg) ? `"${arg.replace(/(["\\])/g, '\\$1')}"` : arg,
    )
    .join(' ');
}

/** A profile id from a display name, unique among `taken`. */
export function profileId(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'agent';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}
