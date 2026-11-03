import { describe, expect, it } from 'vitest';
import { TASK_TEMPLATE, boardTemplates, newId, renderPackage, templateOf } from './templates';

const context = { project: 'ame', branch: 'feat/board', main: 'main' };

describe('renderPackage', () => {
  it('fills the title and fields by label, ignoring case', () => {
    const text = renderPackage(
      TASK_TEMPLATE,
      { title: 'Add a board', fields: { ticket: 'AME-12', description: 'Columns\nand cards' } },
      context,
    );
    expect(text).toBe('Add a board\n\nTicket: AME-12\n\nColumns\nand cards');
  });

  it('drops lines whose placeholders are all empty', () => {
    const text = renderPackage(
      TASK_TEMPLATE,
      { title: 'Fix it', fields: { ticket: ' ' } },
      context,
    );
    expect(text).toBe('Fix it');
  });

  it('fills project placeholders of the template, not of typed values', () => {
    const template = {
      ...TASK_TEMPLATE,
      prompt: 'In {project} on {branch}: {title}\n{description}',
    };
    const text = renderPackage(
      template,
      { title: 'Go', fields: { description: 'keep {main} literal' } },
      context,
    );
    expect(text).toBe('In ame on feat/board: Go\nkeep {main} literal');
  });

  it('appends fields the prompt does not mention', () => {
    const template = { ...TASK_TEMPLATE, prompt: '{title}' };
    const text = renderPackage(template, { title: 'T', fields: { ticket: 'X-1' } }, context);
    expect(text).toBe('T\n\nTicket: X-1');
  });

  it('works without a template', () => {
    expect(renderPackage(undefined, { title: 'Only a title', fields: {} }, context)).toBe(
      'Only a title',
    );
  });
});

describe('templates', () => {
  it('falls back to the built-in template', () => {
    expect(boardTemplates([])).toEqual([TASK_TEMPLATE]);
    const own = { ...TASK_TEMPLATE, id: 'bug', name: 'Bug' };
    expect(boardTemplates([own])).toEqual([own]);
    expect(templateOf([own], 'gone')).toBe(own);
  });

  it('makes ids that are not taken', () => {
    expect(newId('field', ['field-2'])).toBe('field-3');
    expect(newId('field', ['field-1', 'field-2'])).toBe('field-3');
  });
});
