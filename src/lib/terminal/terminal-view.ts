import { Channel } from '@tauri-apps/api/core';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ITheme, Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import { isMac } from '$lib/commands/shortcuts';
import { commands } from '$lib/ipc/bindings';
import { InputQueue } from './input-queue';
import { isNewlineKey, NEWLINE_SEQUENCE } from './keys';

/** Resizes are sent to the program after the size settled for this long. */
const RESIZE_DELAY_MS = 50;
const SCROLLBACK_LINES = 5000;

export interface TerminalViewOptions {
  theme: ITheme;
  /** Called with the size in cells whenever it changes. */
  onResize?: (cols: number, rows: number) => void;
}

/** Loads xterm.js only when the first terminal is shown. */
function loadXterm() {
  return Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-unicode11'),
    import('@xterm/addon-web-links'),
    import('@xterm/xterm/css/xterm.css'),
  ]);
}

/**
 * One xterm.js instance attached to a backend session. Only visible
 * sessions have one; output of hidden sessions stays in the backend buffer
 * and is replayed on attach.
 */
export class TerminalView {
  readonly #id: number;
  readonly #queue: InputQueue;
  #term: Terminal | null = null;
  #fit: FitAddon | null = null;
  #token: number | null = null;
  #disposed = false;
  #observer: ResizeObserver | null = null;
  #resizeTimer: ReturnType<typeof setTimeout> | undefined;
  #fitFrame = 0;
  #focusWhenReady = false;
  #onResize: ((cols: number, rows: number) => void) | undefined;

  constructor(id: number) {
    this.#id = id;
    this.#queue = new InputQueue((data) => commands.writeSession(id, data));
  }

  async mount(container: HTMLElement, options: TerminalViewOptions): Promise<void> {
    const [{ Terminal }, { FitAddon }, { Unicode11Addon }, { WebLinksAddon }] = await loadXterm();
    const style = getComputedStyle(document.documentElement);
    const fontFamily = style.getPropertyValue('--ame-font-code').trim();
    const fontSize = Number.parseFloat(style.getPropertyValue('--ame-font-size-code')) || 13;
    // Cell sizes are measured on open, so the font must be ready first.
    await document.fonts.load(`${fontSize}px "JetBrains Mono Variable"`).catch(() => []);
    if (this.#disposed) return;

    const term = new Terminal({
      fontFamily,
      fontSize,
      theme: options.theme,
      scrollback: SCROLLBACK_LINES,
      // Programs mix ANSI colors freely (e.g. `ls` on shared folders); keep
      // all text readable (WCAG AA).
      minimumContrastRatio: 4.5,
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new Unicode11Addon());
    term.unicode.activeVersion = '11';
    term.loadAddon(new WebLinksAddon((_event, uri) => void openUrl(uri)));
    term.open(container);
    await loadRenderer(term);
    if (this.#disposed) {
      term.dispose();
      return;
    }
    fit.fit();
    this.#term = term;
    this.#fit = fit;
    this.#onResize = options.onResize;

    term.attachCustomKeyEventHandler((event) => this.#onKey(event));
    term.onData((data) => this.#queue.push(data));
    term.onResize(({ cols, rows }) => this.#scheduleResize(cols, rows));
    this.#observer = new ResizeObserver(() => this.fit());
    this.#observer.observe(container);

    // The program redraws at the right size before the replay is shown.
    await commands.resizeSession(this.#id, term.cols, term.rows);
    this.#onResize?.(term.cols, term.rows);
    const channel = new Channel<string>();
    channel.onmessage = (text) => {
      if (!this.#disposed) term.write(text);
    };
    const result = await commands.attachSession(this.#id, channel);
    if (result.status === 'ok') {
      if (this.#disposed) void commands.detachSession(this.#id, result.data);
      else this.#token = result.data;
    }
    if (this.#focusWhenReady) term.focus();
  }

  setTheme(theme: ITheme): void {
    if (this.#term) this.#term.options.theme = theme;
  }

  focus(): void {
    if (this.#term) this.#term.focus();
    else this.#focusWhenReady = true;
  }

  /** Fits the terminal to its container, at most once per frame. */
  fit(): void {
    if (this.#fitFrame) return;
    this.#fitFrame = requestAnimationFrame(() => {
      this.#fitFrame = 0;
      if (!this.#disposed) this.#fit?.fit();
    });
  }

  dispose(): void {
    this.#disposed = true;
    this.#observer?.disconnect();
    clearTimeout(this.#resizeTimer);
    cancelAnimationFrame(this.#fitFrame);
    if (this.#token !== null) void commands.detachSession(this.#id, this.#token);
    this.#term?.dispose();
    this.#term = null;
  }

  #scheduleResize(cols: number, rows: number): void {
    clearTimeout(this.#resizeTimer);
    this.#resizeTimer = setTimeout(() => {
      void commands.resizeSession(this.#id, cols, rows);
      this.#onResize?.(cols, rows);
    }, RESIZE_DELAY_MS);
  }

  /**
   * Shift+Enter inserts a line break instead of submitting (see
   * {@link isNewlineKey}). Copy and paste with Ctrl+Shift+C/V on Linux and
   * Windows (plain Ctrl+C and Ctrl+V belong to the program). macOS uses the
   * native Cmd+C/V.
   */
  #onKey(event: KeyboardEvent): boolean {
    if (isNewlineKey(event)) {
      // xterm.js sees keydown, keypress and keyup; all must be swallowed,
      // or it sends a plain Enter as well.
      if (event.type === 'keydown') this.#queue.push(NEWLINE_SEQUENCE);
      event.preventDefault();
      return false;
    }
    if (isMac || event.type !== 'keydown' || !event.ctrlKey || !event.shiftKey) return true;
    const term = this.#term;
    if (event.code === 'KeyC' && term?.hasSelection()) {
      void writeText(term.getSelection());
      event.preventDefault();
      return false;
    }
    if (event.code === 'KeyV') {
      event.preventDefault();
      void readText()
        .then((text) => text && this.#term?.paste(text))
        .catch(() => {});
      return false;
    }
    return true;
  }
}

/** GPU rendering with WebGL; xterm.js falls back to its DOM renderer. */
async function loadRenderer(term: Terminal): Promise<void> {
  try {
    const { WebglAddon } = await import('@xterm/addon-webgl');
    const webgl = new WebglAddon();
    webgl.onContextLoss(() => webgl.dispose());
    term.loadAddon(webgl);
  } catch {
    // No WebGL (e.g. some WebKitGTK setups): the DOM renderer stays active.
  }
}
