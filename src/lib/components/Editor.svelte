<script lang="ts">
  import { EditorView } from '@codemirror/view';
  import type { EditorGroup, OpenFile } from '$lib/project/editors.svelte';

  /** Shows the active file of an editor group in a single CodeMirror view. */
  let { group, file }: { group: EditorGroup; file: OpenFile } = $props();

  let host: HTMLDivElement;
  let view: EditorView | null = null;
  let shown: OpenFile | null = null;

  function rememberScroll() {
    if (view && shown) shown.scroll = view.scrollSnapshot();
  }

  $effect(() => {
    const created = new EditorView({ parent: host });
    view = created;
    group.attachView(created);
    return () => {
      rememberScroll();
      group.attachView(null);
      created.destroy();
      view = null;
      shown = null;
    };
  });

  $effect(() => {
    const target = file;
    if (!view || !target.editorState || shown === target) return;
    rememberScroll();
    shown = target;
    view.setState(target.editorState);
    if (target.scroll) view.dispatch({ effects: target.scroll });
    view.focus();
  });
</script>

<div class="editor" bind:this={host}></div>

<style>
  .editor {
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
</style>
