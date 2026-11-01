/** Helpers for project-relative paths with `/` separators (`""` is the root). */

export function dirname(path: string): string {
  const index = path.lastIndexOf('/');
  return index === -1 ? '' : path.slice(0, index);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

/** Lower-case extension without the dot, e.g. `ts`; `""` if there is none. */
export function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf('.');
  return index <= 0 ? '' : name.slice(index + 1).toLowerCase();
}

/** All ancestor directories, from the root down: `a/b/c` → `["", "a", "a/b"]`. */
export function ancestors(path: string): string[] {
  const parts = path.split('/').slice(0, -1);
  return ['', ...parts.map((_, i) => parts.slice(0, i + 1).join('/'))];
}

/** Whether `path` is `dir` or lies inside it. */
export function isWithin(path: string, dir: string): boolean {
  return dir === '' || path === dir || path.startsWith(`${dir}/`);
}

/**
 * The given paths plus all their ancestor directories except the root, e.g.
 * to mark collapsed folders that contain unsaved files.
 */
export function withAncestors(paths: Iterable<string>): Set<string> {
  const result = new Set<string>();
  for (const path of paths) {
    result.add(path);
    for (const dir of ancestors(path)) if (dir !== '') result.add(dir);
  }
  return result;
}
