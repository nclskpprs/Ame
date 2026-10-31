import type { LanguageSupport } from '@codemirror/language';
import { basename, extension } from '$lib/fs/paths';

export type LanguageId = 'javascript' | 'typescript' | 'json' | 'css' | 'html' | 'markdown' | 'php';

const byExtension: Record<string, LanguageId> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  tsx: 'typescript',
  json: 'json',
  jsonc: 'json',
  css: 'css',
  html: 'html',
  htm: 'html',
  svelte: 'html',
  vue: 'html',
  md: 'markdown',
  markdown: 'markdown',
  php: 'php',
};

const byName: Record<string, LanguageId> = {
  '.babelrc': 'json',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
  'composer.lock': 'json',
};

export function languageIdFor(path: string): LanguageId | null {
  return byName[basename(path)] ?? byExtension[extension(path)] ?? null;
}

/** Loads language support on demand, so unused grammars are never fetched. */
export async function loadLanguage(path: string): Promise<LanguageSupport | null> {
  const jsx = /x$/.test(extension(path));
  switch (languageIdFor(path)) {
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript({ jsx });
    case 'typescript':
      return (await import('@codemirror/lang-javascript')).javascript({ typescript: true, jsx });
    case 'json':
      return (await import('@codemirror/lang-json')).json();
    case 'css':
      return (await import('@codemirror/lang-css')).css();
    case 'html':
      return (await import('@codemirror/lang-html')).html();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'php':
      return (await import('@codemirror/lang-php')).php();
    case null:
      return null;
  }
}
