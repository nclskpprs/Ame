/** Short-lived inline notices (errors, confirmations) shown in the sidebar. */

export interface Notice {
  id: number;
  message: string;
  kind: 'error' | 'info';
}

const DISMISS_AFTER_MS = 8000;

let nextId = 1;
let list = $state<Notice[]>([]);

export const notices = {
  get list(): readonly Notice[] {
    return list;
  },

  push(message: string, kind: Notice['kind'] = 'error'): void {
    const id = nextId++;
    list = [...list, { id, message, kind }];
    setTimeout(() => this.dismiss(id), DISMISS_AFTER_MS);
  },

  dismiss(id: number): void {
    list = list.filter((notice) => notice.id !== id);
  },
};
