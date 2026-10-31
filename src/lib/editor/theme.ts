import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';

/**
 * Editor and syntax theme. It only references the design tokens (CSS custom
 * properties), so it follows theme switches without reconfiguring editors.
 */
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'var(--ame-bg)',
    color: 'var(--ame-text)',
    fontSize: 'var(--ame-font-size-code)',
  },
  '.cm-scroller': {
    fontFamily: 'var(--ame-font-code)',
    lineHeight: '1.6',
  },
  '.cm-content': { caretColor: 'var(--ame-accent)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ame-accent)', borderLeftWidth: '2px' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'color-mix(in srgb, var(--ame-accent) 28%, transparent)' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ame-surface) 70%, transparent)' },
  '.cm-gutters': {
    backgroundColor: 'var(--ame-bg)',
    color: 'var(--ame-text-muted)',
    border: 'none',
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ame-text)' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 12px 0 16px' },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--ame-surface)',
    border: '1px solid var(--ame-border)',
    color: 'var(--ame-text-muted)',
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'color-mix(in srgb, var(--ame-done) 22%, transparent)',
  },
  '.cm-selectionMatch': {
    backgroundColor: 'color-mix(in srgb, var(--ame-accent) 14%, transparent)',
  },
  '.cm-searchMatch': {
    backgroundColor: 'color-mix(in srgb, var(--ame-needs-input) 30%, transparent)',
  },
  '.cm-searchMatch.cm-searchMatch-selected': {
    backgroundColor: 'color-mix(in srgb, var(--ame-needs-input) 55%, transparent)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--ame-surface)',
    color: 'var(--ame-text)',
  },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--ame-border)' },
  '.cm-panels.cm-panels-bottom': { borderTop: '1px solid var(--ame-border)' },
  '.cm-textfield': {
    backgroundColor: 'var(--ame-bg)',
    border: '1px solid var(--ame-border)',
    color: 'var(--ame-text)',
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: 'var(--ame-bg)',
    border: '1px solid var(--ame-border)',
    color: 'var(--ame-text)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--ame-surface)',
    border: '1px solid var(--ame-border)',
    color: 'var(--ame-text)',
  },
});

const highlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.moduleKeyword],
    color: 'var(--ame-syntax-keyword)',
  },
  {
    tag: [tags.operatorKeyword, tags.definitionKeyword, tags.modifier],
    color: 'var(--ame-syntax-keyword)',
  },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--ame-syntax-string)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--ame-syntax-number)' },
  {
    tag: [tags.comment, tags.lineComment, tags.blockComment],
    color: 'var(--ame-syntax-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--ame-syntax-function)',
  },
  { tag: [tags.typeName, tags.className, tags.namespace], color: 'var(--ame-syntax-type)' },
  {
    tag: [tags.propertyName, tags.variableName, tags.labelName],
    color: 'var(--ame-syntax-property)',
  },
  {
    tag: [tags.operator, tags.punctuation, tags.bracket, tags.separator],
    color: 'var(--ame-syntax-operator)',
  },
  { tag: [tags.tagName, tags.angleBracket], color: 'var(--ame-syntax-tag)' },
  { tag: tags.attributeName, color: 'var(--ame-syntax-attribute)' },
  { tag: [tags.link, tags.url], color: 'var(--ame-syntax-link)', textDecoration: 'underline' },
  { tag: tags.heading, color: 'var(--ame-text)', fontWeight: '600' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: '600' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: [tags.meta, tags.processingInstruction], color: 'var(--ame-syntax-operator)' },
  { tag: tags.invalid, color: 'var(--ame-syntax-invalid)' },
]);

export const ameTheme: Extension = [editorTheme, syntaxHighlighting(highlightStyle)];
