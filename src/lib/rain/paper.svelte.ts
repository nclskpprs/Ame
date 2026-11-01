/**
 * The origami easter egg: a swirl of folded paper over the window, a nod to
 * the paper ninja of the hidden rain village (Ame means rain). Triggered
 * by a secret command in the palette.
 */
class PaperStore {
  /** Grows with every request; the overlay reacts to changes. */
  bursts = $state(0);

  burst(): void {
    this.bursts += 1;
  }
}

export const paper = new PaperStore();
