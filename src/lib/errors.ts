import { error as logError, info as logInfo } from '@tauri-apps/plugin-log';

/**
 * Forwards uncaught frontend errors to the backend log, so they show up in
 * the terminal of `pnpm tauri dev`. In release builds the log plugin is not
 * registered and this is a no-op.
 */
export function forwardErrorsToLog(): void {
  const forward = (message: string) => void logError(`[frontend] ${message}`).catch(() => {});
  window.addEventListener('error', (event) => {
    forward(`${event.message} at ${event.filename}:${event.lineno}:${event.colno}`);
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason: unknown = event.reason;
    forward(
      `unhandled rejection: ${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}`,
    );
  });
}

/** Logs how long the frontend took from navigation start to the first mount. */
export function logStartupTime(): void {
  const ms = Math.round(performance.now());
  void logInfo(`[frontend] mounted after ${ms} ms`).catch(() => {});
}
