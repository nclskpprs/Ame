import { t } from '$lib/i18n';
import { palette } from '$lib/palette/palette.svelte';
import { everythingSource, fileSource } from '$lib/palette/sources';
import { closeGuard } from '$lib/project/close-guard.svelte';
import { activeSession } from '$lib/project/session';
import { settings } from '$lib/stores/settings.svelte';
import { view } from '$lib/stores/view.svelte';
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
const hasSeveralSessions = () => (activeSession()?.terminals.sessions.length ?? 0) > 1;

/** Commands that are always available. Returns a cleanup function. */
export function registerAppCommands(): () => void {
  const projectSlots: Command[] = Array.from({ length: 9 }, (_, i) => ({
    id: `workspace.switchProject${i + 1}`,
    title: 'commands.switchProject',
    shortcut: `Mod+${i + 1}`,
    hidden: true,
    terminal: true,
    run: () => {
      const project = orderedProjects(workspace.projects)[i];
      if (project) void workspace.activate(project.path);
    },
  }));

  const openPalette = () =>
    palette.open({
      label: t('palette.label'),
      placeholder: t('palette.placeholder'),
      empty: t('palette.empty'),
      source: everythingSource(activeSession()),
    });

  return registerCommands([
    {
      id: 'palette.open',
      title: 'commands.commandPalette',
      shortcut: 'Mod+K',
      hidden: true,
      run: openPalette,
    },
    {
      id: 'palette.openAlt',
      title: 'commands.commandPalette',
      shortcut: 'Mod+Shift+P',
      hidden: true,
      terminal: true,
      run: openPalette,
    },
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
      run: () => workspace.activePath && closeGuard.closeProject(workspace.activePath),
    },
    {
      id: 'workspace.nextProject',
      title: 'commands.nextProject',
      shortcut: 'Mod+Alt+ArrowDown',
      terminal: true,
      when: hasSeveralProjects,
      run: () => switchTo(1),
    },
    {
      id: 'workspace.previousProject',
      title: 'commands.previousProject',
      shortcut: 'Mod+Alt+ArrowUp',
      terminal: true,
      when: hasSeveralProjects,
      run: () => switchTo(-1),
    },
    ...projectSlots,
    {
      id: 'quickOpen.open',
      title: 'commands.goToFile',
      shortcut: 'Mod+P',
      when: hasProject,
      run: () => {
        const session = activeSession();
        if (!session) return;
        palette.open({
          label: t('quickOpen.label'),
          placeholder: t('quickOpen.placeholder'),
          empty: t('quickOpen.empty'),
          source: fileSource(session),
        });
      },
    },
    {
      id: 'search.open',
      title: 'commands.searchInProject',
      shortcut: 'Mod+Shift+F',
      terminal: true,
      when: hasProject,
      run: () => {
        const session = activeSession();
        if (!session) return;
        workspace.updateLayout(session.path, { sidePanel: 'search' });
        session.search.focusRequest++;
      },
    },
    {
      id: 'files.show',
      title: 'commands.showFiles',
      shortcut: 'Mod+Shift+E',
      terminal: true,
      when: hasProject,
      run: () => {
        const path = workspace.activePath;
        if (path) workspace.updateLayout(path, { sidePanel: 'files' });
      },
    },
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
      id: 'editor.saveAll',
      title: 'commands.saveAllFiles',
      shortcut: 'Mod+Alt+S',
      terminal: true,
      when: () => (activeSession()?.editors.dirtyFiles.length ?? 0) > 0,
      run: () => activeSession()?.editors.saveAll(),
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
      id: 'terminal.toggle',
      title: 'commands.toggleTerminal',
      shortcut: 'Mod+J',
      terminal: true,
      when: hasProject,
      run: () => activeSession()?.terminals.toggle(),
    },
    {
      id: 'terminal.newShell',
      title: 'commands.newShellSession',
      shortcut: 'Mod+Shift+T',
      terminal: true,
      when: hasProject,
      run: () => activeSession()?.terminals.startShell(),
    },
    {
      id: 'terminal.next',
      title: 'commands.nextSession',
      shortcut: 'Mod+Alt+ArrowRight',
      terminal: true,
      when: hasSeveralSessions,
      run: () => activeSession()?.terminals.cycle(1),
    },
    {
      id: 'terminal.previous',
      title: 'commands.previousSession',
      shortcut: 'Mod+Alt+ArrowLeft',
      terminal: true,
      when: hasSeveralSessions,
      run: () => activeSession()?.terminals.cycle(-1),
    },
    {
      id: 'terminal.close',
      title: 'commands.closeSession',
      when: () => activeSession()?.terminals.active != null,
      run: () => {
        const terminals = activeSession()?.terminals;
        const active = terminals?.active;
        if (terminals && active) return terminals.close(active.id);
      },
    },
    {
      id: 'settings.open',
      title: 'commands.openSettings',
      shortcut: 'Mod+,',
      terminal: true,
      run: () => view.openSettings(),
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
