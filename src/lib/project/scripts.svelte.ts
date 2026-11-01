import { commands, type Script } from '$lib/ipc/bindings';

/** Files at the project root whose change means the scripts may differ. */
const MANIFESTS = [
  'package.json',
  'composer.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
];

/** Whether changed paths (project-relative) touch a script manifest. */
export function touchesManifest(paths: readonly string[]): boolean {
  return paths.some((path) => MANIFESTS.includes(path));
}

/** The scripts of one project, read from its root manifests. */
export class ScriptState {
  readonly project: string;
  list = $state.raw<Script[]>([]);

  constructor(project: string) {
    this.project = project;
  }

  async refresh(): Promise<void> {
    const result = await commands.listScripts(this.project);
    if (result.status === 'ok') this.list = result.data;
  }
}
