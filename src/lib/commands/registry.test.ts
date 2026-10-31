import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleShortcut, paletteCommands, registerCommands, runCommand } from './registry';

let cleanup: (() => void) | undefined;
afterEach(() => cleanup?.());

function keydown(init: Partial<KeyboardEvent>): KeyboardEvent {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...init,
  } as unknown as KeyboardEvent;
}

describe('command registry', () => {
  it('lists visible, available commands for the palette', () => {
    cleanup = registerCommands([
      { id: 'a', title: 'app.name', run: () => {} },
      { id: 'b', title: 'app.name', hidden: true, run: () => {} },
      { id: 'c', title: 'app.name', when: () => false, run: () => {} },
    ]);
    expect(paletteCommands().map((c) => c.id)).toEqual(['a']);
  });

  it('runs commands by id and respects `when`', () => {
    const run = vi.fn();
    let enabled = false;
    cleanup = registerCommands([{ id: 'x', title: 'app.name', when: () => enabled, run }]);
    runCommand('x');
    expect(run).not.toHaveBeenCalled();
    enabled = true;
    runCommand('x');
    expect(run).toHaveBeenCalledOnce();
  });

  it('runs a command for a matching shortcut and stops the event', () => {
    const run = vi.fn();
    cleanup = registerCommands([{ id: 'esc', title: 'app.name', shortcut: 'Escape', run }]);
    const event = keydown({ key: 'Escape', code: 'Escape' });
    expect(handleShortcut(event)).toBe(true);
    expect(run).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(handleShortcut(keydown({ key: 'a', code: 'KeyA' }))).toBe(false);
  });

  it('leaves Ctrl shortcuts to a focused terminal unless the command opts in', () => {
    const inEditor = vi.fn();
    const everywhere = vi.fn();
    cleanup = registerCommands([
      { id: 'k', title: 'app.name', shortcut: 'Mod+K', run: inEditor },
      { id: 'j', title: 'app.name', shortcut: 'Mod+J', terminal: true, run: everywhere },
    ]);
    const terminal = {
      closest: (selector: string) => (selector === '.xterm' ? {} : null),
    } as unknown as EventTarget;
    const ctrl = (key: string) =>
      keydown({ key, code: `Key${key.toUpperCase()}`, ctrlKey: true, target: terminal });
    const cmd = (key: string) =>
      keydown({ key, code: `Key${key.toUpperCase()}`, metaKey: true, target: terminal });

    expect(handleShortcut(ctrl('k'), false)).toBe(false);
    expect(handleShortcut(ctrl('j'), false)).toBe(true);
    expect(everywhere).toHaveBeenCalledOnce();
    // Cmd never reaches the program, so on macOS every command runs.
    expect(handleShortcut(cmd('k'), true)).toBe(true);
    expect(inEditor).toHaveBeenCalledOnce();
    // Outside the terminal, Ctrl+K works as usual.
    expect(handleShortcut(keydown({ key: 'k', code: 'KeyK', ctrlKey: true }), false)).toBe(true);
  });

  it('unregisters commands', () => {
    registerCommands([{ id: 'gone', title: 'app.name', run: () => {} }])();
    expect(paletteCommands().map((c) => c.id)).not.toContain('gone');
  });
});
