//! PTY session manager with ring buffers.
//!
//! Every session runs one program (an agent or a shell) in a pseudo
//! terminal. Output is kept in a ring buffer per session and streamed in
//! throttled batches to the terminal view that is attached, if any. Hidden
//! sessions keep running; their output is replayed when a view attaches.

pub mod commands;
pub mod env;
pub mod manager;
pub mod modes;
pub mod ring;
pub mod session;
pub mod tree;
pub mod utf8;

pub use manager::{PtyManager, SpawnSpec};
pub use session::{SessionId, SessionInfo, SessionStatus};
