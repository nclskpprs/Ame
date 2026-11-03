/**
 * Templates for board work packages and the prompt made from a package.
 * Templates live in `settings.templates`; without any, the built-in "Task"
 * template is used. Prompts are instructions for agents, so the built-in
 * one is written in English.
 */
import { fillPlaceholders, type PromptContext } from '$lib/agents/prompts';
import type { Package, PackageTemplate } from '$lib/ipc/types';

/** The default template: a ticket and a description. */
export const TASK_TEMPLATE: PackageTemplate = {
  id: 'task',
  name: 'Task',
  fields: [
    { id: 'ticket', label: 'Ticket', multiline: false },
    { id: 'description', label: 'Description', multiline: true },
  ],
  prompt: '{title}\n\nTicket: {Ticket}\n\n{Description}',
};

/** The user's templates, or the built-in one when there are none. */
export function boardTemplates(custom: readonly PackageTemplate[]): PackageTemplate[] {
  return custom.length ? [...custom] : [TASK_TEMPLATE];
}

/** The template of a package; the first one if it was deleted since. */
export function templateOf(
  templates: readonly PackageTemplate[],
  id: string,
): PackageTemplate | undefined {
  return templates.find((template) => template.id === id) ?? templates[0];
}

const PLACEHOLDER = /\{([^{}\n]+)\}/g;

/**
 * Fills a template prompt with the title and field values of a package.
 * Field placeholders use the field label and ignore case (`{ticket}` works
 * for "Ticket"). A line whose placeholders are all empty is dropped, so an
 * empty ticket does not leave "Ticket: " behind. Fields the prompt does not
 * mention are appended, so nothing typed into the package gets lost.
 * `{project}`, `{branch}` and `{main}` in the template are filled from
 * `context`; values typed into the package stay as they are.
 */
export function renderPackage(
  template: PackageTemplate | undefined,
  item: Pick<Package, 'title' | 'fields'>,
  context: PromptContext,
): string {
  const values = new Map<string, string>([['title', item.title.trim()]]);
  const fields = template?.fields ?? [];
  for (const field of fields) {
    values.set(field.label.trim().toLowerCase(), (item.fields[field.id] ?? '').trim());
  }
  const used = new Set<string>();
  const prompt = fillPlaceholders(template?.prompt ?? '{title}', context);
  const lines = prompt.split('\n').flatMap((line) => {
    let placeholders = 0;
    let filled = 0;
    const text = line.replace(PLACEHOLDER, (match, name: string) => {
      const key = name.trim().toLowerCase();
      const value = values.get(key);
      if (value === undefined) return match;
      used.add(key);
      placeholders++;
      if (value) filled++;
      return value;
    });
    return placeholders > 0 && filled === 0 ? [] : [text];
  });

  const rest = fields.flatMap((field) => {
    const key = field.label.trim().toLowerCase();
    const value = values.get(key);
    return !used.has(key) && value ? [`${field.label.trim()}: ${value}`] : [];
  });
  const text = [lines.join('\n'), ...rest].join('\n\n');
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** A new id that none of `taken` has. */
export function newId(prefix: string, taken: readonly string[]): string {
  let n = taken.length + 1;
  while (taken.includes(`${prefix}-${n}`)) n++;
  return `${prefix}-${n}`;
}
