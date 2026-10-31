import en from '$locales/en.json';

/** The English messages are the source of truth for all keys. */
export type Messages = typeof en;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every translatable key, e.g. `"settings.theme.label"`. */
export type MessageKey = Leaves<Messages>;

export type MessageParams = Record<string, string | number>;

type MessageTree = { [key: string]: string | MessageTree };

export const DEFAULT_LOCALE = 'en';

// Other locales are loaded lazily so they do not grow the startup bundle.
const loaders = import.meta.glob<{ default: MessageTree }>([
  '../../../locales/*.json',
  '!../../../locales/en.json',
]);

/** Locale codes for which a file exists in `locales/`. */
export const availableLocales: string[] = [
  DEFAULT_LOCALE,
  ...Object.keys(loaders).map((path) => path.replace(/^.*\/(.+)\.json$/, '$1')),
].sort();

let active = $state.raw<{ code: string; messages: MessageTree }>({
  code: DEFAULT_LOCALE,
  messages: en,
});

/** The currently active locale code. */
export function locale(): string {
  return active.code;
}

/**
 * Switches the UI language. Unknown locales fall back to English; keys missing
 * in a locale fall back to English when they are rendered.
 */
export async function setLocale(code: string): Promise<void> {
  if (code === active.code) return;
  const loader = loaders[`../../../locales/${code}.json`];
  if (code === DEFAULT_LOCALE || !loader) {
    active = { code: DEFAULT_LOCALE, messages: en };
    return;
  }
  const module = await loader();
  active = { code, messages: module.default };
}

/**
 * Returns the translation for `key` in the active locale. `{name}`
 * placeholders are replaced with values from `params`.
 */
export function t(key: MessageKey, params?: MessageParams): string {
  const message = lookup(active.messages, key) ?? lookup(en, key) ?? key;
  return params ? interpolate(message, params) : message;
}

export function lookup(tree: MessageTree, key: string): string | undefined {
  let node: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

export function interpolate(message: string, params: MessageParams): string {
  return message.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
