/** Which view fills the main area: the active project or the settings. */
class ViewState {
  settingsOpen = $state(false);
  /** Element that had focus before the settings opened, to restore it. */
  #returnFocus: HTMLElement | null = null;

  openSettings(): void {
    if (this.settingsOpen) return;
    this.#returnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.settingsOpen = true;
  }

  closeSettings(): void {
    if (!this.settingsOpen) return;
    this.settingsOpen = false;
    const target = this.#returnFocus;
    this.#returnFocus = null;
    if (target?.isConnected) queueMicrotask(() => target.focus());
  }

  toggleSettings(): void {
    if (this.settingsOpen) this.closeSettings();
    else this.openSettings();
  }
}

export const view = new ViewState();
