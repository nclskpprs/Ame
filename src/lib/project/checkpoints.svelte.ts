import { commands, type Checkpoint, type CheckpointFile } from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';
import { notices } from '$lib/stores/notices.svelte';

/** How many files a restore would add back, change and delete. */
export interface RestoreSummary {
  /** Deleted since the checkpoint; restoring brings them back. */
  back: number;
  changed: number;
  /** New since the checkpoint; restoring removes them. */
  removed: number;
}

export function summarize(files: readonly CheckpointFile[]): RestoreSummary {
  const summary = { back: 0, changed: 0, removed: 0 };
  for (const file of files) {
    if (file.change === 'deleted') summary.back++;
    else if (file.change === 'added') summary.removed++;
    else summary.changed++;
  }
  return summary;
}

/**
 * Git checkpoints of one project (ADR 0023): taken by the backend before
 * every prompt to an agent, listed and restored from the changes panel.
 */
export class CheckpointState {
  readonly project: string;
  list = $state.raw<Checkpoint[]>([]);
  /** The checkpoint whose changed files are shown. */
  expanded = $state<string | null>(null);
  files = $state.raw<CheckpointFile[] | null>(null);
  /** A restore waits for its inline confirmation. */
  confirming = $state<string | null>(null);
  /** After a restore: the checkpoint that undoes it. */
  undo = $state.raw<Checkpoint | null>(null);
  busy = $state(false);
  /** Called after files were restored (to reload editors and git). */
  onRestored: (() => void) | null = null;

  constructor(project: string) {
    this.project = project;
  }

  async refresh(): Promise<void> {
    const result = await commands.listCheckpoints(this.project);
    if (result.status === 'ok') this.list = result.data;
  }

  /** Shows or hides the files that changed since a checkpoint. */
  async toggle(id: string): Promise<void> {
    if (this.expanded === id) {
      this.expanded = null;
      return;
    }
    this.expanded = id;
    this.files = null;
    const result = await commands.checkpointChanges(this.project, id);
    if (this.expanded !== id) return;
    if (result.status === 'ok') this.files = result.data;
    else notices.push(describeError(result.error));
  }

  async create(label: string): Promise<void> {
    const result = await commands.createCheckpoint(this.project, label);
    if (result.status === 'error') notices.push(describeError(result.error));
    await this.refresh();
  }

  async restore(id: string): Promise<void> {
    this.confirming = null;
    this.busy = true;
    try {
      const result = await commands.restoreCheckpoint(this.project, id);
      if (result.status === 'error') {
        notices.push(describeError(result.error));
        return;
      }
      this.undo = result.data;
      this.expanded = null;
      this.onRestored?.();
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  /** Undoes the last restore. */
  async undoRestore(): Promise<void> {
    const undo = this.undo;
    if (!undo) return;
    await this.restore(undo.id);
    this.undo = null;
  }
}
