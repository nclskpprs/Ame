import { stateLabels } from '$lib/agents/state';
import { t } from '$lib/i18n';
import type { AgentState, TrayImage, TrayModel_Deserialize } from '$lib/ipc/bindings';
import type { SessionInfo } from '$lib/ipc/types';

/** Most urgent first, like the dashboard. */
const ORDER: readonly AgentState[] = [
  'needsInput',
  'error',
  'working',
  'starting',
  'idle',
  'exited',
];

/**
 * The tray menu and tooltip: one entry per session, most urgent first, and
 * a tooltip that says how many agents wait or work.
 */
export function trayModel(
  list: readonly SessionInfo[],
  projectName: (path: string) => string,
  icon: TrayImage | null,
): TrayModel_Deserialize {
  const waiting = list.filter((s) => s.state === 'needsInput').length;
  const working = list.filter((s) => s.state === 'working' || s.state === 'starting').length;
  const tooltip = waiting
    ? t('tray.tooltipWaiting', { count: waiting })
    : working
      ? t('tray.tooltipWorking', { count: working })
      : t('app.name');
  const sessions = [...list]
    .sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state) || a.id - b.id)
    .map((session) => ({
      id: session.id,
      label: t('tray.session', {
        agent: session.title,
        project: projectName(session.project),
        state: t(stateLabels[session.state]),
      }),
    }));
  return {
    tooltip,
    showLabel: t('tray.show'),
    quitLabel: t('tray.quit'),
    sessions,
    icon,
  };
}
