import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DEFAULT_FILE_ICON, DEFAULT_FOLDER_ICON, allIcons, iconName, iconUrl } from './file-icons';

const PUBLIC = fileURLToPath(new URL('../../../public/file-icons/', import.meta.url));

describe('iconName', () => {
  it('maps file names, compound and simple extensions', () => {
    expect(iconName('package.json', 'file')).toBe('nodejs');
    expect(iconName('README.md', 'file')).toBe('readme');
    expect(iconName('notes.md', 'file')).toBe('markdown');
    expect(iconName('App.tsx', 'file')).toBe('react_ts');
    expect(iconName('a.test.ts', 'file')).toBe('test-ts');
    expect(iconName('types.d.ts', 'file')).toBe('typescript');
    expect(iconName('main.rs', 'file')).toBe('rust');
    expect(iconName('Dockerfile', 'file')).toBe('docker');
  });

  it('maps variants of well-known names', () => {
    expect(iconName('Dockerfile.dev', 'file')).toBe('docker');
    expect(iconName('.env.local', 'file')).toBe('settings');
  });

  it('falls back to default icons', () => {
    expect(iconName('notes', 'file')).toBe(DEFAULT_FILE_ICON);
    expect(iconName('weird.xyz', 'file')).toBe(DEFAULT_FILE_ICON);
    expect(iconName('anything', 'dir')).toBe(DEFAULT_FOLDER_ICON);
  });

  it('maps folders', () => {
    expect(iconName('src', 'dir')).toBe('folder-src');
    expect(iconName('.github', 'dir')).toBe('folder-github');
    expect(iconName('node_modules', 'dir')).toBe('folder-node');
  });
});

describe('iconUrl', () => {
  it('uses light variants where they exist', () => {
    expect(iconUrl('toml', 'light')).toBe('/file-icons/toml_light.svg');
    expect(iconUrl('toml', 'dark')).toBe('/file-icons/toml.svg');
    expect(iconUrl('rust', 'light')).toBe('/file-icons/rust.svg');
  });
});

describe('bundled icons', () => {
  it.each(allIcons())('%s.svg exists', (icon) => {
    expect(existsSync(`${PUBLIC}${icon}.svg`)).toBe(true);
  });
});
