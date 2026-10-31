/** A piece of a label, highlighted if it was matched by the search. */
export interface Segment {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into highlighted and plain segments. `indices` are positions
 * of Unicode code points (as returned by the fuzzy matcher), shifted by
 * `offset` when `text` is only the tail of the matched string.
 */
export function segments(text: string, indices: readonly number[], offset = 0): Segment[] {
  const marked = new Set(indices.map((index) => index - offset));
  const result: Segment[] = [];
  Array.from(text).forEach((char, index) => {
    const match = marked.has(index);
    const last = result.at(-1);
    if (last && last.match === match) last.text += char;
    else result.push({ text: char, match });
  });
  return result;
}

/** Splits matched ranges (UTF-16 offsets) of a line into segments. */
export function rangeSegments(
  text: string,
  ranges: readonly { start: number; end: number }[],
): Segment[] {
  const result: Segment[] = [];
  let position = 0;
  for (const { start, end } of ranges) {
    if (start > position) result.push({ text: text.slice(position, start), match: false });
    if (end > start) result.push({ text: text.slice(start, end), match: true });
    position = Math.max(position, end);
  }
  if (position < text.length) result.push({ text: text.slice(position), match: false });
  return result;
}
