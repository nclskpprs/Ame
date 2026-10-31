# 0009. Typed IPC with tauri-specta

- **Status:** Accepted
- **Date:** 2026-10-31

## Context

Hand-written TypeScript types for Tauri commands drift from the Rust types
and fail only at runtime.

## Decision

Generate the TypeScript bindings from Rust with **specta** and
**tauri-specta**. All commands are registered in `ipc::builder()`. Debug
builds and `cargo test` write `src/lib/ipc/bindings.ts`; CI fails when the
committed file is stale. Fallible commands return `Result<T, Error>` and are
exposed as `{ status: "ok", data } | { status: "error", error }`. The error
type is a tagged enum (`{ kind, message }`), exported as `AppError` so it
does not shadow the JavaScript `Error` class.

Types whose serialized and deserialized shapes differ (e.g. structs with
`#[serde(default)]`) are exported twice by tauri-specta: `Foo_Serialize` is
what the backend sends (all fields present), `Foo_Deserialize` what it
accepts (fields optional).

tauri-specta 2 is still a release candidate, so the versions of `specta`,
`specta-typescript` and `tauri-specta` are pinned exactly (`=`).

## Consequences

- Compile-time safety across the IPC boundary and generated docs comments.
- Upgrading tauri-specta requires bumping the pinned versions together.
- Generated code must never be edited by hand.
