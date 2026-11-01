import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { palettes } from './tokens';

const root = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

describe('boot styles', () => {
  it('keeps index.html free of inline <style>', () => {
    // An inline <style> makes Tauri add a hash to the CSP `style-src` in
    // release builds. That disables 'unsafe-inline' and blocks the styles
    // CodeMirror injects at runtime, so the editor renders unstyled.
    const html = readFileSync(root('index.html'), 'utf8');
    expect(html).not.toMatch(/<style[\s>]/i);
    expect(html).toContain('href="/boot.css"');
  });

  it('paints the theme backgrounds from the design tokens', () => {
    const css = readFileSync(root('public/boot.css'), 'utf8').toLowerCase();
    expect(css).toContain(palettes.dark.bg.toLowerCase());
    expect(css).toContain(palettes.light.bg.toLowerCase());
  });
});
