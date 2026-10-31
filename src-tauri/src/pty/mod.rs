//! PTY session manager with ring buffers and process tree tracking.
//!
//! Planned for M2 (`portable-pty`). Hidden sessions keep running and their
//! output is buffered here until a terminal view is opened.
