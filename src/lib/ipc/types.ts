/**
 * Friendly names for the generated IPC types. Values sent by the backend have
 * all fields present (`*_Serialize`); see ADR 0009.
 */
import type {
  AppError,
  ProjectLayout_Serialize,
  Project_Serialize,
  Settings_Serialize,
  WorkspaceState_Serialize,
} from './bindings';

export type Settings = Settings_Serialize;
export type Project = Project_Serialize;
export type ProjectLayout = ProjectLayout_Serialize;
export type WorkspaceState = WorkspaceState_Serialize;

/** A technical, English description of an IPC error for logs and notices. */
export function describeError(error: AppError): string {
  return 'message' in error ? error.message : error.kind;
}
