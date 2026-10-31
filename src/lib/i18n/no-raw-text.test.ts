import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import { describe, expect, it } from 'vitest';

/**
 * Guards the rule "no UI string without an i18n key": Svelte templates must
 * not contain literal text or literal values for user-visible attributes.
 * Render text with `t('key')` instead.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const VISIBLE_ATTRIBUTES = new Set([
  'aria-label',
  'title',
  'placeholder',
  'alt',
  'aria-description',
]);
const HAS_LETTER = /\p{L}/u;

type Node = { type?: string; [key: string]: unknown };

function findRawText(node: unknown, found: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((child) => findRawText(child, found));
    return;
  }
  if (!node || typeof node !== 'object') return;
  const current = node as Node;

  if (current.type === 'Text' && typeof current.data === 'string') {
    if (HAS_LETTER.test(current.data)) found.push(current.data.trim());
    return;
  }
  if (current.type === 'Attribute' && typeof current.name === 'string') {
    if (VISIBLE_ATTRIBUTES.has(current.name) && Array.isArray(current.value)) {
      for (const part of current.value as Node[]) {
        if (part.type === 'Text' && HAS_LETTER.test(String(part.data))) {
          found.push(`${current.name}="${String(part.data)}"`);
        }
      }
    }
    return;
  }
  for (const [key, value] of Object.entries(current)) {
    // Expressions are code, not text; style blocks are not rendered text.
    if (key === 'expression' || key === 'metadata' || key === 'css') continue;
    findRawText(value, found);
  }
}

const files = globSync('**/*.svelte', { cwd: SRC });

describe('Svelte components contain no raw UI text', () => {
  it('finds components to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(file, () => {
      const ast = parse(readFileSync(`${SRC}/${file}`, 'utf8'), { modern: true });
      const found: string[] = [];
      findRawText(ast.fragment, found);
      expect(found, 'use t() from $lib/i18n instead of literal text').toEqual([]);
    });
  }
});
