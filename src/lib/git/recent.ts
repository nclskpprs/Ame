import { ancestors } from '$lib/fs/paths';
import type { GitFile } from '$lib/ipc/types';

/** Recently changed files: path → when the change was noticed (ms). */
export type Recent = ReadonlyMap<string, number>;

export const NO_RECENT: Recent = new Map();

/** How long a file changed by an agent stays highlighted. */
export const RECENT_MS = 60_000;

/**
 * Files that changed on disk since the previous status: newly changed files
 * and files with a newer modification time. Nothing counts as changed on the
 * first status (`previous` is `null`), so opening a project highlights
 * nothing.
 */
export function changedFiles(
  previous: ReadonlyMap<string, number> | null,
  files: readonly GitFile[],
): string[] {
  if (!previous) return [];
  return files
    .filter((file) => file.modified !== null && file.modified > (previous.get(file.path) ?? -1))
    .map((file) => file.path);
}

/** Modification times of the files of a status, for the next comparison. */
export function modificationTimes(files: readonly GitFile[]): Map<string, number> {
  return new Map(
    files.flatMap((file) => (file.modified === null ? [] : [[file.path, file.modified] as const])),
  );
}

/** The most recently modified of `paths`. */
export function newest(paths: readonly string[], files: readonly GitFile[]): string | null {
  let best: GitFile | null = null;
  for (const file of files) {
    if (!paths.includes(file.path) || file.modified === null) continue;
    if (!best || (best.modified ?? 0) < file.modified) best = file;
  }
  return best?.path ?? null;
}

/**
 * Adds newly changed files and drops expired ones. Returns `null` when
 * nothing changed, so callers can keep the old map.
 */
export function updateRecent(
  recent: Recent,
  changed: readonly string[],
  now: number,
): Recent | null {
  const kept = [...recent].filter(([, at]) => now - at < RECENT_MS);
  if (!changed.length && kept.length === recent.size) return null;
  return new Map([...kept, ...changed.map((path) => [path, now] as const)]);
}

/** Recently changed files and the folders that contain them. */
export function withFolders(recent: Recent): ReadonlySet<string> {
  return new Set([...recent.keys()].flatMap((path) => [path, ...ancestors(path).filter(Boolean)]));
}
