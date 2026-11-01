import { describe, expect, it, vi } from 'vitest';
import { promptPreview } from './queue';

vi.mock('$lib/ipc/bindings', () => ({ commands: {}, events: {} }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));

describe('promptPreview', () => {
  it('shows a single line as it is', () => {
    expect(promptPreview('  fix the tests ')).toBe('fix the tests');
  });

  it('marks prompts with more lines', () => {
    expect(promptPreview('\n\nrefactor this\nand that')).toBe('refactor this …');
  });

  it('shortens long lines', () => {
    const preview = promptPreview('x'.repeat(300));
    expect(preview).toHaveLength(120);
    expect(preview.endsWith('…')).toBe(true);
  });
});
