import {
  Compartment,
  EditorState,
  type Extension,
  type StateEffect,
  Text,
} from '@codemirror/state';
import { EditorView, type ViewUpdate } from '@codemirror/view';
import { minimalChange } from '$lib/editor/diff';
import { loadLanguage } from '$lib/editor/languages';
import { baseExtensions, lineSeparatorFor } from '$lib/editor/setup';
import { basename, dirname } from '$lib/fs/paths';
import { t } from '$lib/i18n';
import { commands } from '$lib/ipc/bindings';
import { describeError, type ProjectLayout } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';

export type FileStatus = 'unloaded' | 'loading' | 'ready' | 'binary' | 'tooLarge' | 'error';

/** An editor tab. CodeMirror state lives outside Svelte's reactivity. */
export class OpenFile {
  readonly path: string;
  status = $state<FileStatus>('unloaded');
  dirty = $state(false);
  /** The file changed on disk while there were unsaved edits. */
  conflict = $state(false);
  /** The file was deleted on disk. */
  deleted = $state(false);
  /** Error message or size, depending on the status. */
  detail = $state('');
  /** Changes against the committed version are shown inline. */
  diff = $state(false);
  readonly diffCompartment = new Compartment();
  editorState: EditorState | null = null;
  saved: Text = Text.empty;
  scroll: StateEffect<unknown> | null = null;

  constructor(path: string) {
    this.path = path;
  }

  get name(): string {
    return basename(this.path);
  }
}

/** The editor tabs of one project. */
export class EditorGroup {
  readonly project: string;
  files = $state<OpenFile[]>([]);
  activePath = $state<string | null>(null);
  /** A dirty tab waiting for "save / don't save / cancel". */
  pendingClose = $state<string | null>(null);
  #view: EditorView | null = null;
  #onChange: () => void;
  /** When each file was last saved by the editor (ms). */
  #savedAt: Record<string, number> = {};
  /** Whether the editor takes the focus when it shows the next file. */
  #focusOnShow = true;

  /** `onChange` is called when tabs open, close or switch. */
  constructor(project: string, layout: ProjectLayout | undefined, onChange: () => void) {
    this.project = project;
    this.#onChange = onChange;
    this.files = (layout?.openFiles ?? []).map((path) => new OpenFile(path));
    const active = this.files.find((f) => f.path === layout?.activeFile);
    if (active) {
      this.activePath = active.path;
      void this.#load(active);
    }
  }

  get active(): OpenFile | null {
    return this.files.find((f) => f.path === this.activePath) ?? null;
  }

  /** Tabs with unsaved changes. */
  get dirtyFiles(): OpenFile[] {
    return this.files.filter((f) => f.dirty);
  }

  find(path: string): OpenFile | undefined {
    return this.files.find((f) => f.path === path);
  }

  /**
   * The selection of the shown editor: 1-based lines and the selected text
   * (empty for a cursor without selection).
   */
  selection(): { path: string; fromLine: number; toLine: number; text: string } | null {
    const view = this.#view;
    const path = this.activePath;
    if (!view || !path) return null;
    const { from, to } = view.state.selection.main;
    const doc = view.state.doc;
    // A selection ending at the start of a line does not include that line.
    const end = to > from && doc.lineAt(to).from === to ? to - 1 : to;
    return {
      path,
      fromLine: doc.lineAt(from).number,
      toLine: doc.lineAt(end).number,
      text: view.state.sliceDoc(from, to),
    };
  }

  /** Called by the editor component that displays the active file. */
  attachView(view: EditorView | null): void {
    this.#view = view;
  }

  /** Opens a tab; with `focus: false` the focus stays where it is. */
  async open(path: string, { focus = true }: { focus?: boolean } = {}): Promise<void> {
    if (!this.find(path)) this.files = [...this.files, new OpenFile(path)];
    this.#focusOnShow = focus;
    await this.activate(path);
  }

  /** Called by the editor when it shows a file; resets to focusing. */
  takeFocusOnShow(): boolean {
    const focus = this.#focusOnShow;
    this.#focusOnShow = true;
    return focus;
  }

  /** Whether the editor itself wrote this file in the last few seconds. */
  savedRecently(path: string, withinMs = 3000): boolean {
    return Date.now() - (this.#savedAt[path] ?? 0) < withinMs;
  }

  async activate(path: string): Promise<void> {
    const file = this.find(path);
    if (!file) return;
    this.activePath = path;
    this.#onChange();
    if (file.status === 'unloaded') await this.#load(file);
  }

  /** Opens a file and selects a range on a 1-based line, centered. */
  async reveal(path: string, line: number, from: number, to: number): Promise<void> {
    await this.open(path);
    const file = this.find(path);
    const state = file?.editorState;
    if (!file || !state) return;
    const target = state.doc.line(Math.min(Math.max(line, 1), state.doc.lines));
    const selection = {
      anchor: Math.min(target.from + from, target.to),
      head: Math.min(target.from + to, target.to),
    };
    const scroll = EditorView.scrollIntoView(selection.anchor, { y: 'center' });
    if (this.#view && this.#view.state === state) {
      this.#view.dispatch({ selection, effects: scroll });
      this.#view.focus();
    } else {
      file.editorState = state.update({ selection }).state;
      file.scroll = scroll;
    }
  }

  /** Closes a tab. Dirty tabs ask first unless `force` is set. */
  close(path: string, force = false): void {
    const index = this.files.findIndex((f) => f.path === path);
    const file = this.files[index];
    if (!file) return;
    if (file.dirty && !force) {
      this.pendingClose = path;
      void this.activate(path);
      return;
    }
    if (this.pendingClose === path) this.pendingClose = null;
    this.files = this.files.filter((f) => f !== file);
    if (this.activePath === path) {
      const next = this.files[index] ?? this.files[index - 1];
      this.activePath = null;
      if (next) void this.activate(next.path);
    }
    this.#onChange();
  }

  /** Keeps the tab's state in sync with the view (called on every update). */
  #onViewUpdate(file: OpenFile, update: ViewUpdate): void {
    file.editorState = update.state;
    if (update.docChanged) file.dirty = !sameText(update.state.doc, file.saved);
  }

  async save(path: string): Promise<boolean> {
    const file = this.find(path);
    if (!file?.editorState) return false;
    const doc = file.editorState.doc;
    this.#savedAt[path] = Date.now();
    const result = await commands.writeFile(this.project, path, doc.toString());
    if (result.status === 'error') {
      notices.push(
        t('editor.saveFailed', { name: file.name, message: describeError(result.error) }),
      );
      return false;
    }
    file.saved = doc;
    file.dirty = !sameText(file.editorState.doc, doc);
    file.conflict = false;
    file.deleted = false;
    return true;
  }

  /** Saves every tab with unsaved changes; returns whether all succeeded. */
  async saveAll(): Promise<boolean> {
    const results = await Promise.all(this.dirtyFiles.map((file) => this.save(file.path)));
    return results.every(Boolean);
  }

  /**
   * Shows or hides the changes against the committed (`HEAD`) version inline,
   * with buttons to keep or revert each change. New files show everything as
   * added.
   */
  async setDiff(path: string, on: boolean): Promise<void> {
    const file = this.find(path);
    if (!file) return;
    if (file.status === 'unloaded' || file.status === 'loading') await this.#load(file);
    if (file.status !== 'ready') return;
    let extension: Extension = [];
    if (on) {
      const [{ unifiedMergeView }, result] = await Promise.all([
        import('@codemirror/merge'),
        commands.gitOriginal(this.project, path),
      ]);
      const original = result.status === 'ok' ? (result.data ?? '') : '';
      extension = [
        unifiedMergeView({
          original,
          gutter: true,
          // Line backgrounds are enough; underlining every word is noisy.
          highlightChanges: false,
          mergeControls: true,
          syntaxHighlightDeletions: true,
        }),
        // "Accept" keeps a change, "Reject" restores the committed text.
        EditorState.phrases.of({ Accept: t('diff.keep'), Reject: t('diff.revert') }),
      ];
    }
    file.diff = on;
    this.#reconfigure(file, file.diffCompartment.reconfigure(extension));
  }

  /** Compares diff tabs with the new committed version, e.g. after a commit. */
  async refreshDiffs(): Promise<void> {
    await Promise.all(
      this.files.filter((file) => file.diff).map((file) => this.setDiff(file.path, true)),
    );
  }

  /** Re-reads open files that changed on disk. */
  async onFsChanged(paths: readonly string[]): Promise<void> {
    const changed = this.files.filter((f) => f.status === 'ready' && paths.includes(f.path));
    await Promise.all(changed.map((file) => this.#reloadFromDisk(file, false)));
  }

  /** Replaces unsaved edits with the content on disk. */
  async reload(path: string): Promise<void> {
    const file = this.find(path);
    if (file) await this.#reloadFromDisk(file, true);
  }

  /** Keeps the unsaved edits after an external change. */
  keepMine(path: string): void {
    const file = this.find(path);
    if (file) file.conflict = false;
  }

  /** Directories that contain open files, for the file watcher. */
  watchedDirs(): string[] {
    return this.files.map((f) => dirname(f.path));
  }

  layout(): Pick<ProjectLayout, 'openFiles' | 'activeFile'> {
    return { openFiles: this.files.map((f) => f.path), activeFile: this.activePath };
  }

  async #load(file: OpenFile): Promise<void> {
    file.status = 'loading';
    const [result, language] = await Promise.all([
      commands.readFile(this.project, file.path),
      loadLanguage(file.path),
    ]);
    if (result.status === 'error') {
      file.status = 'error';
      file.detail = describeError(result.error);
      return;
    }
    const content = result.data;
    if (content.kind === 'binary') {
      file.status = 'binary';
    } else if (content.kind === 'tooLarge') {
      file.status = 'tooLarge';
      file.detail = String(content.megabytes);
    } else {
      file.editorState = EditorState.create({
        doc: content.text,
        extensions: [
          baseExtensions(),
          file.diffCompartment.of([]),
          lineSeparatorFor(content.text),
          language ?? [],
          EditorView.updateListener.of((update) => this.#onViewUpdate(file, update)),
        ],
      });
      file.saved = file.editorState.doc;
      file.status = 'ready';
    }
  }

  async #reloadFromDisk(file: OpenFile, force: boolean): Promise<void> {
    const result = await commands.readFile(this.project, file.path);
    if (result.status === 'error') {
      file.deleted = true;
      return;
    }
    if (result.data.kind !== 'text' || !file.editorState) return;
    file.deleted = false;
    const diskDoc = file.editorState.toText(result.data.text);
    if (sameText(diskDoc, file.saved) && !force) return; // e.g. our own save
    if (file.dirty && !force) {
      file.conflict = true;
      return;
    }
    const change = minimalChange(file.editorState.doc.toString(), diskDoc.toString());
    if (change) this.#dispatch(file, { changes: change });
    file.saved = file.editorState.doc;
    file.dirty = false;
    file.conflict = false;
  }

  #reconfigure(file: OpenFile, effects: StateEffect<unknown>): void {
    if (this.#view && this.activePath === file.path) {
      this.#view.dispatch({ effects });
    } else if (file.editorState) {
      file.editorState = file.editorState.update({ effects }).state;
    }
  }

  /** Applies a change through the view if the file is shown, else directly. */
  #dispatch(file: OpenFile, spec: { changes: { from: number; to: number; insert: string } }): void {
    if (this.#view && this.activePath === file.path) {
      this.#view.dispatch(spec);
    } else if (file.editorState) {
      file.editorState = file.editorState.update(spec).state;
    }
  }
}

function sameText(a: Text, b: Text): boolean {
  return a.length === b.length && a.eq(b);
}
