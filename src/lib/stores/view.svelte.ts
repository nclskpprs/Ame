import { tick } from 'svelte';
import { currentPage, type Page } from './navigation';
import { workspace } from './workspace.svelte';

/** A view that replaces the active project in the main area. */
export type Overlay = 'settings' | 'dashboard' | 'board';

/** Which view fills the main area: the active project, the settings or the dashboard. */
class ViewState {
  overlay = $state<Overlay | null>(null);
  /** Element that had focus before an overlay opened, to restore it. */
  #returnFocus: HTMLElement | null = null;

  get settingsOpen(): boolean {
    return this.overlay === 'settings';
  }

  get dashboardOpen(): boolean {
    return this.overlay === 'dashboard';
  }

  /** The page the sidebar marks as current. */
  get page(): Page {
    return currentPage(this.overlay, workspace.activePath);
  }

  /**
   * Shows a project's page, or its board: what a click on a sidebar entry
   * does. Unlike `toggle` it never hides the page that is already shown.
   */
  async showProject(path: string, overlay: 'board' | null = null): Promise<void> {
    if (path !== workspace.activePath) {
      await workspace.activate(path);
      // Switching projects closes overlays (App.svelte); open ours after that.
      await tick();
    }
    if (overlay) this.open(overlay);
    else this.close(false);
  }

  open(overlay: Overlay): void {
    if (this.overlay === overlay) return;
    if (this.overlay === null) {
      this.#returnFocus =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    this.overlay = overlay;
  }

  /** Back to the project; `restoreFocus` returns the focus to where it was. */
  close(restoreFocus = true): void {
    if (this.overlay === null) return;
    this.overlay = null;
    const target = this.#returnFocus;
    this.#returnFocus = null;
    if (restoreFocus && target?.isConnected) queueMicrotask(() => target.focus());
  }

  toggle(overlay: Overlay): void {
    if (this.overlay === overlay) this.close();
    else this.open(overlay);
  }

  openSettings(): void {
    this.open('settings');
  }

  closeSettings(): void {
    if (this.settingsOpen) this.close();
  }

  toggleSettings(): void {
    this.toggle('settings');
  }
}

export const view = new ViewState();
