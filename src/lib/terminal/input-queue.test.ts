import { describe, expect, it } from 'vitest';
import { InputQueue } from './input-queue';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('InputQueue', () => {
  it('sends one write at a time and joins keys typed meanwhile', async () => {
    const sent: string[] = [];
    const gates: ReturnType<typeof deferred>[] = [];
    const queue = new InputQueue((data) => {
      sent.push(data);
      const gate = deferred();
      gates.push(gate);
      return gate.promise;
    });

    queue.push('a');
    queue.push('b');
    queue.push('c');
    expect(sent).toEqual(['a']);

    gates[0]?.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(sent).toEqual(['a', 'bc']);

    gates[1]?.resolve();
    await Promise.resolve();
    queue.push('d');
    await Promise.resolve();
    expect(sent).toEqual(['a', 'bc', 'd']);
  });

  it('keeps working after a failed write', async () => {
    const sent: string[] = [];
    let fail = true;
    const queue = new InputQueue(async (data) => {
      sent.push(data);
      if (fail) {
        fail = false;
        throw new Error('gone');
      }
    });
    queue.push('x');
    await new Promise((resolve) => setTimeout(resolve, 0));
    queue.push('y');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent).toEqual(['x', 'y']);
  });
});
