/**
 * Remembers which directories the backend watches, so the set is only sent
 * when it changed. The first call always reports a change, also when only
 * the project root (`""`) is watched.
 */
export class WatchSet {
  #last: string | null = null;

  /** The sorted, unique directories if they differ from the last call, else `null`. */
  update(dirs: readonly string[]): string[] | null {
    const unique = [...new Set(dirs)].sort();
    const key = JSON.stringify(unique);
    if (key === this.#last) return null;
    this.#last = key;
    return unique;
  }
}
