import type { Segment } from './highlight';

/** An entry in the command palette or quick open. */
export interface PaletteItem {
  id: string;
  label: Segment[];
  detail?: Segment[];
  /** e.g. a formatted shortcut. */
  hint?: string;
  run: () => unknown;
}

/** Produces the items for a query. May be async (e.g. backend fuzzy search). */
export type PaletteSource = (query: string) => PaletteItem[] | Promise<PaletteItem[]>;

export interface PaletteConfig {
  label: string;
  placeholder: string;
  empty: string;
  source: PaletteSource;
  initialQuery?: string;
}

let current = $state.raw<PaletteConfig | null>(null);

/** The palette overlay; only one is open at a time. */
export const palette = {
  get config(): PaletteConfig | null {
    return current;
  },
  open(config: PaletteConfig): void {
    current = config;
  },
  close(): void {
    current = null;
  },
};
