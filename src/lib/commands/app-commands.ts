import { activeSession } from '$lib/project/session';
import { settings } from '$lib/stores/settings.svelte';
import { workspace } from '$lib/stores/workspace.svelte';
import { orderedProjects } from '$lib/workspace/sections';
import { registerCommands, type Command } from './registry';

function switchTo(offset: number): void {
  const projects = orderedProjects(workspace.projects);
  const index = projects.findIndex((p) => p.path === workspace.activePath);
  const next = projects[(index + offset + projects.length) % projects.length];
  if (next) void workspace.activate(next.path);
}

const hasProject = () => workspace.active !== null;
const activeFile = () => activeSession()?.editors.active ?? null;
const hasSeveralProjects = () => workspace.projects.length > 1;

/** Commands that are always available. Returns a cleanup function. */
export function registerAppCommands(): () => void {
  const projectSlots: Command[] = Array.from({ length: 9 }, (_, i) => ({
    id: `workspace.switchProject${i + 1}`,
    title: 'commands.switchProject',
    shortcut: `Mod+${i + 1}`,
    hidden: true,
    run: () => {
      const project = orderedProjects(workspace.projects)[i];
      if (project) void workspace.activate(project.path);
    },
  }));

  return registerCommands([
    {
      id: 'workspace.openFolder',
      title: 'commands.openFolder',
      shortcut: 'Mod+O',
      run: () => workspace.openFolder(),
    },
    {
      id: 'workspace.closeProject',
      title: 'commands.closeProject',
      when: hasProject,
      run: () => workspace.activePath && workspace.remove(workspace.activePath),
    },
    {
      id: 'workspace.nextProject',
      title: 'commands.nextProject',
      shortcut: 'Mod+Alt+ArrowDown',
      when: hasSeveralProjects,
      run: () => switchTo(1),
    },
    {
      id: 'workspace.previousProject',
      title: 'commands.previousProject',
      shortcut: 'Mod+Alt+ArrowUp',
      when: hasSeveralProjects,
      run: () => switchTo(-1),
    },
    ...projectSlots,
    {
      id: 'editor.save',
      title: 'commands.saveFile',
      shortcut: 'Mod+S',
      when: () => activeFile()?.status === 'ready',
      run: () => {
        const file = activeFile();
        if (file) return activeSession()?.editors.save(file.path);
      },
    },
    {
      id: 'editor.close',
      title: 'commands.closeEditor',
      shortcut: 'Mod+W',
      when: () => activeFile() !== null,
      run: () => {
        const file = activeFile();
        if (file) activeSession()?.editors.close(file.path);
      },
    },
    {
      id: 'theme.system',
      title: 'commands.themeSystem',
      run: () => settings.update({ theme: 'system' }),
    },
    {
      id: 'theme.dark',
      title: 'commands.themeDark',
      run: () => settings.update({ theme: 'dark' }),
    },
    {
      id: 'theme.light',
      title: 'commands.themeLight',
      run: () => settings.update({ theme: 'light' }),
    },
    {
      id: 'density.comfortable',
      title: 'commands.densityComfortable',
      run: () => settings.update({ density: 'comfortable' }),
    },
    {
      id: 'density.compact',
      title: 'commands.densityCompact',
      run: () => settings.update({ density: 'compact' }),
    },
    { id: 'rain.on', title: 'commands.rainOn', run: () => settings.update({ rainEffects: 'on' }) },
    {
      id: 'rain.subtle',
      title: 'commands.rainSubtle',
      run: () => settings.update({ rainEffects: 'subtle' }),
    },
    {
      id: 'rain.off',
      title: 'commands.rainOff',
      run: () => settings.update({ rainEffects: 'off' }),
    },
  ]);
}
