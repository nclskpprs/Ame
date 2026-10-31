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
  // Inline diff (@codemirror/merge), see EditorGroup.setDiff.
  '.cm-changedLine, .cm-inlineChangedLine': {
    backgroundColor: 'color-mix(in srgb, var(--ame-git-added) 9%, transparent)',
  },
  '.cm-changedText': {
    background:
      'linear-gradient(var(--ame-git-added), var(--ame-git-added)) bottom / 100% 2px no-repeat',
  },
  '.cm-deletedChunk': {
    backgroundColor: 'color-mix(in srgb, var(--ame-git-deleted) 9%, transparent)',
  },
  '.cm-deletedChunk .cm-deletedText, .cm-deletedText': {
    background:
      'linear-gradient(var(--ame-git-deleted), var(--ame-git-deleted)) bottom / 100% 2px no-repeat',
  },
  '.cm-changeGutter': { width: '3px', paddingLeft: '0' },
  '.cm-changedLineGutter': { backgroundColor: 'var(--ame-git-added)' },
  '.cm-deletedLineGutter': { backgroundColor: 'var(--ame-git-deleted)' },
  '.cm-deletedChunk .cm-chunkButtons button': {
    padding: '0 6px',
    border: '1px solid var(--ame-border)',
    borderRadius: '4px',
    backgroundColor: 'var(--ame-surface)',
    color: 'var(--ame-text)',
    fontFamily: 'var(--ame-font-ui)',
  },
  '.cm-deletedChunk .cm-chunkButtons button[name=accept]': {
    borderColor: 'var(--ame-git-added)',
    background: 'var(--ame-surface)',
  },
  '.cm-deletedChunk .cm-chunkButtons button[name=reject]': {
    borderColor: 'var(--ame-git-deleted)',
    background: 'var(--ame-surface)',
  },
  '.cm-collapsedLines': {
    color: 'var(--ame-text-muted)',
    background: 'var(--ame-surface)',
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
  // Diffs and patches.
  { tag: tags.inserted, color: 'var(--ame-syntax-string)' },
  { tag: tags.deleted, color: 'var(--ame-syntax-invalid)' },
  { tag: tags.changed, color: 'var(--ame-syntax-number)' },
]);

export const ameTheme: Extension = [editorTheme, syntaxHighlighting(highlightStyle)];
