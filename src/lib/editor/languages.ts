import { LanguageSupport, StreamLanguage, type StreamParser } from '@codemirror/language';
import { basename, extension } from '$lib/fs/paths';

export type LanguageId =
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'css'
  | 'scss'
  | 'sass'
  | 'html'
  | 'xml'
  | 'markdown'
  | 'php'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'csharp'
  | 'cpp'
  | 'sql'
  | 'yaml'
  | 'toml'
  | 'shell'
  | 'powershell'
  | 'dockerfile'
  | 'ruby'
  | 'lua'
  | 'swift'
  | 'properties'
  | 'diff';

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
  json5: 'json',
  css: 'css',
  less: 'css',
  scss: 'scss',
  sass: 'sass',
  html: 'html',
  htm: 'html',
  svelte: 'html',
  vue: 'html',
  xml: 'xml',
  svg: 'xml',
  xsd: 'xml',
  xsl: 'xml',
  plist: 'xml',
  csproj: 'xml',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  php: 'php',
  py: 'python',
  pyi: 'python',
  pyw: 'python',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  cs: 'csharp',
  c: 'cpp',
  h: 'cpp',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  hxx: 'cpp',
  sql: 'sql',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  psm1: 'powershell',
  psd1: 'powershell',
  dockerfile: 'dockerfile',
  rb: 'ruby',
  lua: 'lua',
  swift: 'swift',
  ini: 'properties',
  cfg: 'properties',
  properties: 'properties',
  env: 'properties',
  diff: 'diff',
  patch: 'diff',
};

const byName: Record<string, LanguageId> = {
  '.babelrc': 'json',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
  'composer.lock': 'json',
  'Cargo.lock': 'toml',
  Dockerfile: 'dockerfile',
  Containerfile: 'dockerfile',
  Gemfile: 'ruby',
  Rakefile: 'ruby',
  '.bashrc': 'shell',
  '.bash_profile': 'shell',
  '.zshrc': 'shell',
  '.profile': 'shell',
  '.env': 'properties',
  '.editorconfig': 'properties',
  '.npmrc': 'properties',
  '.gitconfig': 'properties',
};

export function languageIdFor(path: string): LanguageId | null {
  const name = basename(path);
  // `Dockerfile.dev`, `.env.local`, …
  const prefix = name
    .split('.')
    .slice(0, name.startsWith('.') ? 2 : 1)
    .join('.');
  return byName[name] ?? byExtension[extension(path)] ?? byName[prefix] ?? null;
}

function legacy(parser: StreamParser<unknown>): LanguageSupport {
  return new LanguageSupport(StreamLanguage.define(parser));
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
    case 'scss':
      return (await import('@codemirror/lang-sass')).sass();
    case 'sass':
      return (await import('@codemirror/lang-sass')).sass({ indented: true });
    case 'html':
      return (await import('@codemirror/lang-html')).html();
    case 'xml':
      return (await import('@codemirror/lang-xml')).xml();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    case 'php':
      return (await import('@codemirror/lang-php')).php();
    case 'python':
      return (await import('@codemirror/lang-python')).python();
    case 'rust':
      return (await import('@codemirror/lang-rust')).rust();
    case 'go':
      return (await import('@codemirror/lang-go')).go();
    case 'java':
      return (await import('@codemirror/lang-java')).java();
    case 'kotlin':
      return legacy((await import('@codemirror/legacy-modes/mode/clike')).kotlin);
    case 'csharp':
      return legacy((await import('@codemirror/legacy-modes/mode/clike')).csharp);
    case 'cpp':
      return (await import('@codemirror/lang-cpp')).cpp();
    case 'sql':
      return (await import('@codemirror/lang-sql')).sql();
    case 'yaml':
      return (await import('@codemirror/lang-yaml')).yaml();
    case 'toml':
      return legacy((await import('@codemirror/legacy-modes/mode/toml')).toml);
    case 'shell':
      return legacy((await import('@codemirror/legacy-modes/mode/shell')).shell);
    case 'powershell':
      return legacy((await import('@codemirror/legacy-modes/mode/powershell')).powerShell);
    case 'dockerfile':
      return legacy((await import('@codemirror/legacy-modes/mode/dockerfile')).dockerFile);
    case 'ruby':
      return legacy((await import('@codemirror/legacy-modes/mode/ruby')).ruby);
    case 'lua':
      return legacy((await import('@codemirror/legacy-modes/mode/lua')).lua);
    case 'swift':
      return legacy((await import('@codemirror/legacy-modes/mode/swift')).swift);
    case 'properties':
      return legacy((await import('@codemirror/legacy-modes/mode/properties')).properties);
    case 'diff':
      return legacy((await import('@codemirror/legacy-modes/mode/diff')).diff);
    case null:
      return null;
  }
}
