import { t } from '$lib/i18n';

/** A short running time, e.g. `45 s`, `12 min`, `2 h 5 min`. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 60) return t('duration.seconds', { n: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('duration.minutes', { n: minutes });
  return t('duration.hours', { h: Math.floor(minutes / 60), m: minutes % 60 });
}
