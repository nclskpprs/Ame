import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guards the one button system (docs/DESIGN.md, Controls): text buttons use
 * the global `.btn` from app.css instead of a look of their own, so every
 * button answers hover, press and disabled the same way.
 */

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const files = globSync('**/*.svelte', { cwd: SRC }).map((file) => ({
  file,
  source: readFileSync(SRC + file, 'utf8'),
}));

describe('button system', () => {
  it('gives every primary or danger button the .btn class', () => {
    const offenders = files.flatMap(({ file, source }) =>
      [...source.matchAll(/<button\b[^>]*>/gs)].flatMap(([tag]) => {
        const classes = /class="([^"]*)"/.exec(tag)?.[1]?.split(/\s+/) ?? [];
        const variant =
          classes.includes('primary') ||
          classes.includes('danger') ||
          tag.includes('class:primary');
        return variant && !classes.includes('btn') ? [`${file}: ${tag.slice(0, 60)}`] : [];
      }),
    );
    expect(offenders).toEqual([]);
  });

  it('keeps components from styling their own bordered buttons', () => {
    const offenders = files.flatMap(({ file, source }) => {
      const style = /<style>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '';
      return [...style.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, selector = '', body = '']) =>
        /(^|[\s,>])button\b/.test(selector) && /border:\s*1px solid/.test(body)
          ? [`${file}: ${selector.trim()}`]
          : [],
      );
    });
    expect(offenders).toEqual([]);
  });
});
