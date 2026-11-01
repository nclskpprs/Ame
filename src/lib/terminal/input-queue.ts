/**
 * Sends terminal input one write at a time. Keys typed while a write is in
 * flight are joined into the next one, so their order is always kept and a
 * slow program does not pile up requests.
 */
export class InputQueue {
  #pending = '';
  #busy = false;
  readonly #send: (data: string) => Promise<unknown>;

  constructor(send: (data: string) => Promise<unknown>) {
    this.#send = send;
  }

  push(data: string): void {
    this.#pending += data;
    void this.#flush();
  }

  async #flush(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      while (this.#pending) {
        const data = this.#pending;
        this.#pending = '';
        // A failed write (e.g. the program exited) drops only that input.
        await this.#send(data).catch(() => {});
      }
    } finally {
      this.#busy = false;
    }
  }
}
