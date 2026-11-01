//! Discovery and execution of `package.json` and `composer.json` scripts.
//!
//! A script runs as a terminal session of its project (profile
//! `script:<id>`), so status, exit code, notifications and restart work like
//! for agents.

pub mod commands;
pub mod detect;

/// Profile ids of script sessions start with this.
pub const SCRIPT_PROFILE_PREFIX: &str = "script:";
