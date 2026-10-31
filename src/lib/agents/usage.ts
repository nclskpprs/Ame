import { t } from '$lib/i18n';

export interface Usage {
  /** Percent of one core. */
  cpu: number;
  /** Resident memory in bytes. */
  memory: number;
}

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Sums the usage of several sessions, `null` if none was measured. */
export function sumUsage(items: readonly Usage[]): Usage | null {
  if (items.length === 0) return null;
  return items.reduce(
    (sum, item) => ({ cpu: sum.cpu + item.cpu, memory: sum.memory + item.memory }),
    {
      cpu: 0,
      memory: 0,
    },
  );
}

/** Memory as "412 MB" or "1.4 GB". */
export function formatMemory(bytes: number): string {
  if (bytes >= GB) return t('usage.gb', { value: (bytes / GB).toFixed(1) });
  return t('usage.mb', { value: String(Math.round(bytes / MB)) });
}

/** CPU as "12 %" (of one core). */
export function formatCpu(cpu: number): string {
  return t('usage.cpu', { value: String(Math.round(cpu)) });
}

/** "CPU 12 % · RAM 412 MB", e.g. for a tooltip. */
export function describeUsage(usage: Usage): string {
  return t('usage.summary', { cpu: formatCpu(usage.cpu), memory: formatMemory(usage.memory) });
}
