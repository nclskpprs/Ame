import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/ipc/bindings', () => ({ commands: {}, events: {} }));
vi.mock('$lib/stores/notices.svelte', () => ({ notices: { push: vi.fn() } }));

const { formatReference } = await import('./send');

describe('formatReference', () => {
  it('sends the location and the code in a fence', () => {
    expect(
      formatReference({ path: 'src/a.ts', fromLine: 3, toLine: 4, text: 'const a = 1;\nlet b;' }),
    ).toBe('src/a.ts:3-4\n```typescript\nconst a = 1;\nlet b;\n```\n');
  });

  it('sends only the location without a selection', () => {
    expect(formatReference({ path: 'README.md', fromLine: 7, toLine: 7, text: '' })).toBe(
      'README.md:7 ',
    );
  });

  it('uses a longer fence when the code contains backticks', () => {
    const text = 'Use ```js\ncode\n```\n';
    expect(formatReference({ path: 'notes.txt', fromLine: 1, toLine: 3, text })).toBe(
      `notes.txt:1-3\n\`\`\`\`\n${text}\`\`\`\`\n`,
    );
  });
});
