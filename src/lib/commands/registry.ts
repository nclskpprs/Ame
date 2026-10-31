import type { MessageKey } from '$lib/i18n';
import { matchesShortcut, parseShortcut, type Shortcut } from './shortcuts';

/** An action that can be triggered from the command palette or a shortcut. */
export interface Command {
  id: string;
  /** i18n key of the title shown in the command palette. */
  title: MessageKey;
  /** e.g. `Mod+Shift+F`, see `shortcuts.ts`. */
  shortcut?: string;
  /** Hidden from the command palette (e.g. "switch to project 3"). */
  hidden?: boolean;
  /** The command is only available when this returns true. */
  when?: () => boolean;
  run: () => unknown;
}

interface Registered {
  command: Command;
  shortcut: Shortcut | null;
}

const registry = new Map<string, Registered>();

/** Registers commands; returns a function that unregisters them. */
export function registerCommands(commands: Command[]): () => void {
  for (const command of commands) {
    registry.set(command.id, {
      command,
      shortcut: command.shortcut ? parseShortcut(command.shortcut) : null,
    });
  }
  return () => commands.forEach((command) => registry.delete(command.id));
}

function available(command: Command): boolean {
  return command.when ? command.when() : true;
}

/** Commands for the command palette, in registration order. */
export function paletteCommands(): Command[] {
  return [...registry.values()]
    .map((entry) => entry.command)
    .filter((command) => !command.hidden && available(command));
}

export function runCommand(id: string): void {
  const entry = registry.get(id);
  if (entry && available(entry.command)) void entry.command.run();
}

export function shortcutOf(id: string): Shortcut | null {
  return registry.get(id)?.shortcut ?? null;
}

/**
 * Global keydown handler. Runs the first available command whose shortcut
 * matches and stops the event. Returns whether a command ran.
 */
export function handleShortcut(event: KeyboardEvent): boolean {
  for (const { command, shortcut } of registry.values()) {
    if (shortcut && matchesShortcut(event, shortcut) && available(command)) {
      event.preventDefault();
      event.stopPropagation();
      void command.run();
      return true;
    }
  }
  return false;
}
