import { Channel } from '@tauri-apps/api/core';
import { SvelteSet } from 'svelte/reactivity';
import {
  commands,
  type FileResults,
  type SearchOptions,
  type SearchSummary,
} from '$lib/ipc/bindings';
import { describeError } from '$lib/ipc/types';

export type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

/** Text search state of one project; results survive project switches. */
export class SearchState {
  readonly project: string;
  query = $state('');
  options = $state<SearchOptions>({ caseSensitive: false, regex: false, wholeWord: false });
  results = $state.raw<FileResults[]>([]);
  status = $state<SearchStatus>('idle');
  summary = $state.raw<SearchSummary | null>(null);
  error = $state('');
  readonly collapsed = new SvelteSet<string>();
  /** Incremented to ask the search input to take focus. */
  focusRequest = $state(0);
  #run = 0;

  constructor(project: string) {
    this.project = project;
  }

  async run(): Promise<void> {
    const run = ++this.#run;
    this.collapsed.clear();
    this.results = [];
    this.summary = null;
    this.error = '';
    if (!this.query) {
      this.status = 'idle';
      await commands.cancelSearch();
      return;
    }

    this.status = 'searching';
    const channel = new Channel<FileResults[]>();
    channel.onmessage = (batch) => {
      if (run === this.#run) this.results = [...this.results, ...batch];
    };
    const result = await commands.searchText(this.project, this.query, this.options, channel);
    if (run !== this.#run) return;
    if (result.status === 'ok') {
      this.summary = result.data;
      this.status = 'done';
    } else {
      this.error = describeError(result.error);
      this.status = 'error';
    }
  }
}
