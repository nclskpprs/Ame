/** Result of a fuzzy match: higher scores are better. */
export interface FuzzyMatch {
  score: number;
  /** Code point indices of the matched characters in the text. */
  indices: number[];
}

const isBoundary = (previous: string | undefined, char: string) =>
  previous === undefined ||
  /[\s\-_./:]/.test(previous) ||
  (previous === previous.toLowerCase() && char !== char.toLowerCase());

/**
 * Case-insensitive subsequence match for short lists (commands, projects).
 * Rewards consecutive characters and matches at word starts. File paths are
 * matched in the backend with nucleo instead.
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const needle = Array.from(query.toLowerCase().replace(/\s+/g, ''));
  if (needle.length === 0) return { score: 0, indices: [] };
  const chars = Array.from(text);
  const lower = chars.map((char) => char.toLowerCase());

  const indices: number[] = [];
  let score = 0;
  let from = 0;
  for (const wanted of needle) {
    let index = lower.indexOf(wanted, from);
    // Prefer a later match at a word boundary over an inner one.
    const boundary = lower.findIndex(
      (char, i) => i >= from && char === wanted && isBoundary(chars[i - 1], chars[i] ?? ''),
    );
    if (boundary !== -1 && (index === -1 || indices.at(-1) !== index - 1)) index = boundary;
    if (index === -1) return null;

    score += 1;
    if (indices.at(-1) === index - 1) score += 4;
    if (isBoundary(chars[index - 1], chars[index] ?? '')) score += 3;
    indices.push(index);
    from = index + 1;
  }
  // Shorter texts win ties.
  return { score: score - chars.length * 0.01, indices };
}
