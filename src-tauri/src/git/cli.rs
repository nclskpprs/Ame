//! Runs the git CLI (ADR 0008).

use std::path::Path;
use std::process::{Command, Stdio};

use crate::error::{Error, Result};
use crate::pty::env;

/// Output of a git call that exited successfully.
pub type Stdout = Vec<u8>;

/// Runs `git <args>` in `cwd`. Read-only calls must not take the index lock,
/// so agents running git at the same time are never blocked
/// (`GIT_OPTIONAL_LOCKS=0`).
pub fn git(cwd: &Path, args: &[&str]) -> Result<Stdout> {
    let mut command = Command::new("git");
    command
        .args(args)
        .current_dir(cwd)
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(path) = env::path() {
        command.env("PATH", path);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: no console window flashes up for every call.
        command.creation_flags(0x0800_0000);
    }
    let output = command.output().map_err(|err| match err.kind() {
        std::io::ErrorKind::NotFound => Error::GitMissing,
        _ => Error::Git(err.to_string()),
    })?;
    if output.status.success() {
        Ok(output.stdout)
    } else {
        Err(Error::Git(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ))
    }
}

/// The path of the project folder inside its repository (`""` at the root,
/// else with a trailing `/`), or `None` if the folder is not in a repository.
pub fn repo_prefix(cwd: &Path) -> Result<Option<String>> {
    match git(cwd, &["rev-parse", "--show-prefix"]) {
        Ok(stdout) => Ok(Some(String::from_utf8_lossy(&stdout).trim_end().to_owned())),
        Err(Error::Git(_)) => Ok(None),
        Err(err) => Err(err),
    }
}
