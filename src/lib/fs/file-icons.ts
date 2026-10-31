/**
 * File and folder icons from Material Icon Theme (MIT, see
 * `licenses/material-icon-theme-MIT.txt`). Only a curated subset is bundled
 * in `public/file-icons/`; the browser loads an icon when a row shows it.
 */

import type { EntryKind } from '$lib/ipc/bindings';
import type { ThemeName } from '$lib/theme/tokens';

export const DEFAULT_FILE_ICON = 'document';
export const DEFAULT_FOLDER_ICON = 'folder-base';

/** Icons that have a variant for light backgrounds (`<name>_light.svg`). */
const LIGHT_VARIANTS = new Set(['toml', 'pnpm']);

/** Exact file names, lower case. */
const byName: Record<string, string> = {
  'package.json': 'nodejs',
  'package-lock.json': 'npm',
  '.npmrc': 'npm',
  'pnpm-lock.yaml': 'pnpm',
  'pnpm-workspace.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  '.nvmrc': 'nodejs',
  'cargo.toml': 'rust',
  'cargo.lock': 'lock',
  'composer.json': 'php',
  'composer.lock': 'lock',
  'tsconfig.json': 'tsconfig',
  'jsconfig.json': 'tsconfig',
  dockerfile: 'docker',
  containerfile: 'docker',
  '.dockerignore': 'docker',
  'docker-compose.yml': 'docker',
  'docker-compose.yaml': 'docker',
  'compose.yaml': 'docker',
  makefile: 'makefile',
  '.gitignore': 'git',
  '.gitattributes': 'git',
  '.gitmodules': 'git',
  '.gitkeep': 'git',
  '.gitlab-ci.yml': 'gitlab',
  '.editorconfig': 'editorconfig',
  '.prettierrc': 'prettier',
  '.prettierrc.json': 'prettier',
  '.prettierignore': 'prettier',
  'prettier.config.js': 'prettier',
  'eslint.config.js': 'eslint',
  'eslint.config.mjs': 'eslint',
  '.eslintrc': 'eslint',
  '.eslintrc.json': 'eslint',
  'vite.config.ts': 'vite',
  'vite.config.js': 'vite',
  'vitest.config.ts': 'vitest',
  'jest.config.js': 'jest',
  'svelte.config.js': 'svelte',
  'tauri.conf.json': 'tauri',
  'readme.md': 'readme',
  readme: 'readme',
  'changelog.md': 'changelog',
  'contributing.md': 'contributing',
  'code_of_conduct.md': 'conduct',
  authors: 'authors',
  license: 'license',
  'license.md': 'license',
  'license.txt': 'license',
  'license-mit': 'license',
  'license-apache': 'license',
  'security.md': 'certificate',
  'todo.md': 'todo',
  '.env': 'settings',
};

/** Multi-part extensions, checked before the last extension. */
const byCompoundExtension: Record<string, string> = {
  'd.ts': 'typescript',
  'test.ts': 'test-ts',
  'spec.ts': 'test-ts',
  'test.tsx': 'test-ts',
  'spec.tsx': 'test-ts',
  'test.js': 'test-js',
  'spec.js': 'test-js',
};

const byExtension: Record<string, string> = {
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'react_ts',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'react',
  json: 'json',
  jsonc: 'json',
  json5: 'json',
  css: 'css',
  scss: 'sass',
  sass: 'sass',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  plist: 'xml',
  svelte: 'svelte',
  vue: 'vue',
  md: 'markdown',
  mdx: 'markdown',
  markdown: 'markdown',
  php: 'php',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  c: 'c',
  h: 'h',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'hpp',
  hh: 'hpp',
  sql: 'database',
  db: 'database',
  sqlite: 'database',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sh: 'console',
  bash: 'console',
  zsh: 'console',
  fish: 'console',
  ps1: 'powershell',
  psm1: 'powershell',
  rb: 'ruby',
  lua: 'lua',
  swift: 'swift',
  ini: 'settings',
  cfg: 'settings',
  conf: 'settings',
  properties: 'settings',
  env: 'settings',
  diff: 'diff',
  patch: 'diff',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  webp: 'image',
  ico: 'image',
  bmp: 'image',
  avif: 'image',
  svg: 'svg',
  pdf: 'pdf',
  zip: 'zip',
  gz: 'zip',
  tgz: 'zip',
  tar: 'zip',
  '7z': 'zip',
  rar: 'zip',
  lock: 'lock',
  ttf: 'font',
  otf: 'font',
  woff: 'font',
  woff2: 'font',
  mp3: 'audio',
  wav: 'audio',
  ogg: 'audio',
  flac: 'audio',
  mp4: 'video',
  mov: 'video',
  webm: 'video',
  mkv: 'video',
  csv: 'table',
  tsv: 'table',
  xlsx: 'table',
  log: 'log',
  doc: 'word',
  docx: 'word',
  exe: 'exe',
  msi: 'exe',
  pem: 'certificate',
  crt: 'certificate',
  key: 'key',
  pub: 'key',
  txt: 'document',
};

/** Folder names, lower case. */
const folders: Record<string, string> = {
  src: 'folder-src',
  source: 'folder-src',
  lib: 'folder-lib',
  libs: 'folder-lib',
  docs: 'folder-docs',
  doc: 'folder-docs',
  test: 'folder-test',
  tests: 'folder-test',
  __tests__: 'folder-test',
  spec: 'folder-test',
  node_modules: 'folder-node',
  '.git': 'folder-git',
  '.github': 'folder-github',
  config: 'folder-config',
  '.config': 'folder-config',
  scripts: 'folder-scripts',
  bin: 'folder-scripts',
  public: 'folder-public',
  static: 'folder-public',
  components: 'folder-components',
  resources: 'folder-resource',
  res: 'folder-resource',
  assets: 'folder-resource',
  images: 'folder-images',
  img: 'folder-images',
  icons: 'folder-images',
  dist: 'folder-dist',
  build: 'folder-dist',
  out: 'folder-dist',
  target: 'folder-target',
  tmp: 'folder-temp',
  temp: 'folder-temp',
  utils: 'folder-utils',
  helpers: 'folder-utils',
  styles: 'folder-css',
  css: 'folder-css',
  locales: 'folder-i18n',
  i18n: 'folder-i18n',
  lang: 'folder-i18n',
  docker: 'folder-docker',
  ci: 'folder-ci',
  '.circleci': 'folder-ci',
  '.vscode': 'folder-vscode',
  'src-tauri': 'folder-src-tauri',
  api: 'folder-api',
  app: 'folder-app',
  server: 'folder-server',
  client: 'folder-client',
  routes: 'folder-routes',
  views: 'folder-views',
  android: 'folder-android',
  ios: 'folder-ios',
  licenses: 'folder-license',
};

/** Icon name for a file or folder name (the last path segment). */
export function iconName(name: string, kind: EntryKind): string {
  const lower = name.toLowerCase();
  if (kind === 'dir') return folders[lower] ?? DEFAULT_FOLDER_ICON;
  const named = byName[lower];
  if (named) return named;
  const parts = lower.split('.');
  // `.env.local`, `Dockerfile.dev`: fall back to the name before the dot.
  const stem = lower.startsWith('.') ? `.${parts[1] ?? ''}` : (parts[0] ?? '');
  if (parts.length > 2) {
    const compound = byCompoundExtension[parts.slice(-2).join('.')];
    if (compound) return compound;
  }
  const extension = parts.length > 1 ? parts.at(-1) : undefined;
  return (
    (extension && byExtension[extension]) ??
    (parts.length > 1 ? byName[stem] : undefined) ??
    DEFAULT_FILE_ICON
  );
}

/** URL of an icon for the current theme. */
export function iconUrl(icon: string, theme: ThemeName): string {
  const variant = theme === 'light' && LIGHT_VARIANTS.has(icon) ? `${icon}_light` : icon;
  return `/file-icons/${variant}.svg`;
}

/** Every icon the mapping can return, e.g. to check that all are bundled. */
export function allIcons(): string[] {
  const names = new Set([
    DEFAULT_FILE_ICON,
    DEFAULT_FOLDER_ICON,
    ...Object.values(byName),
    ...Object.values(byCompoundExtension),
    ...Object.values(byExtension),
    ...Object.values(folders),
  ]);
  for (const icon of LIGHT_VARIANTS) names.add(`${icon}_light`);
  return [...names].sort();
}
