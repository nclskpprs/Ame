import { describe, expect, it, vi } from 'vitest';
import { touchesManifest } from './scripts.svelte';

vi.mock('$lib/ipc/bindings', () => ({ commands: {} }));

describe('touchesManifest', () => {
  it('reacts to manifests and lock files at the root only', () => {
    expect(touchesManifest(['src/a.ts', 'package.json'])).toBe(true);
    expect(touchesManifest(['pnpm-lock.yaml'])).toBe(true);
    expect(touchesManifest(['web/package.json', 'README.md'])).toBe(false);
  });
});
