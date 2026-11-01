//! Environment and default shell for new sessions.
//!
//! Apps started from a desktop launcher (Finder, a .desktop file) do not get
//! the `PATH` and variables that the user's shell profile sets up, so agents
//! installed with npm, Homebrew, nvm, … would not be found. On macOS and
//! Linux the environment of a login shell is therefore captured once (in the
//! background at startup) and used for every session and for agent
//! detection.

use std::collections::BTreeMap;
use std::sync::OnceLock;

/// Variables that describe the capturing shell itself, not the user's setup.
const SKIPPED: &[&str] = &[
    "PWD",
    "OLDPWD",
    "SHLVL",
    "_",
    "TERM",
    "COLORTERM",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "AME_SESSION_ID",
];

static LOGIN_ENV: OnceLock<BTreeMap<String, String>> = OnceLock::new();

/// Starts capturing the login shell environment in the background.
pub fn warm_up() {
    let spawned = std::thread::Builder::new()
        .name("login-env".into())
        .spawn(|| {
            login_env();
        });
    if let Err(err) = spawned {
        log::warn!("could not capture the login shell environment: {err}");
    }
}

/// Variables from the user's login shell that differ from the app's own
/// environment. Blocks on the first call until the capture is done (at most
/// a few seconds); empty on Windows or when the capture fails.
pub fn login_env() -> &'static BTreeMap<String, String> {
    LOGIN_ENV.get_or_init(|| {
        let captured = capture::login_env().unwrap_or_default();
        captured
            .into_iter()
            .filter(|(key, value)| {
                !SKIPPED.contains(&key.as_str()) && std::env::var(key).ok().as_ref() != Some(value)
            })
            .collect()
    })
}

/// Looks up a variable, preferring the login shell environment.
pub fn var(key: &str) -> Option<String> {
    login_env()
        .get(key)
        .cloned()
        .or_else(|| std::env::var(key).ok())
}

/// The `PATH` used to find agents and to spawn sessions.
pub fn path() -> Option<String> {
    var("PATH")
}

/// Program and arguments of the user's default shell.
pub fn default_shell() -> (String, Vec<String>) {
    #[cfg(windows)]
    {
        for candidate in ["pwsh.exe", "powershell.exe"] {
            if which::which(candidate).is_ok() {
                return (candidate.to_owned(), vec!["-NoLogo".to_owned()]);
            }
        }
        let comspec = std::env::var("ComSpec").unwrap_or_else(|_| "cmd.exe".to_owned());
        (comspec, Vec::new())
    }
    #[cfg(not(windows))]
    {
        let shell = var("SHELL")
            .filter(|shell| !shell.is_empty())
            .or_else(|| {
                ["/bin/zsh", "/bin/bash"]
                    .into_iter()
                    .find(|shell| std::path::Path::new(shell).exists())
                    .map(str::to_owned)
            })
            .unwrap_or_else(|| "/bin/sh".to_owned());
        (shell, vec!["-l".to_owned()])
    }
}

/// Variables for every session: the login shell environment plus what
/// terminal programs expect from a modern terminal.
pub fn session_env() -> Vec<(String, String)> {
    let mut vars: Vec<(String, String)> = login_env()
        .iter()
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();
    // Windows programs do not rely on TERM, and some misbehave when it is set.
    if cfg!(not(windows)) {
        vars.push(("TERM".into(), "xterm-256color".into()));
    }
    vars.push(("COLORTERM".into(), "truecolor".into()));
    vars.push(("TERM_PROGRAM".into(), "Ame".into()));
    vars.push((
        "TERM_PROGRAM_VERSION".into(),
        env!("CARGO_PKG_VERSION").into(),
    ));
    vars
}

/// File name of a program without directory and extension, e.g. `zsh` for
/// `/bin/zsh` or `pwsh` for `pwsh.exe`.
pub fn program_name(program: &str) -> String {
    let name = program.rsplit(['/', '\\']).next().unwrap_or(program);
    let lower = name.to_ascii_lowercase();
    [".exe", ".cmd", ".bat"]
        .iter()
        .find(|ext| lower.ends_with(*ext))
        .map_or(name, |ext| &name[..name.len() - ext.len()])
        .to_owned()
}

/// Parses the output of `env` between two markers. Lines that do not start
/// with `NAME=` continue the previous value (values with line breaks).
pub fn parse_env_output(output: &str, marker: &str) -> Option<BTreeMap<String, String>> {
    let start = output.find(marker)? + marker.len();
    let end = start + output[start..].find(marker)?;
    let mut vars = BTreeMap::new();
    let mut current: Option<(String, String)> = None;
    for line in output[start..end].lines() {
        match line.split_once('=') {
            Some((name, value)) if is_name(name) => {
                if let Some((name, value)) = current.take() {
                    vars.insert(name, value);
                }
                current = Some((name.to_owned(), value.to_owned()));
            }
            _ => {
                if let Some((_, value)) = current.as_mut() {
                    value.push('\n');
                    value.push_str(line);
                }
            }
        }
    }
    if let Some((name, value)) = current {
        vars.insert(name, value);
    }
    Some(vars)
}

fn is_name(name: &str) -> bool {
    let mut chars = name.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}

#[cfg(windows)]
mod capture {
    use std::collections::BTreeMap;

    /// GUI apps on Windows inherit the user environment already.
    pub fn login_env() -> Option<BTreeMap<String, String>> {
        None
    }
}

#[cfg(not(windows))]
mod capture {
    use std::collections::BTreeMap;
    use std::io::Read;
    use std::process::{Command, Stdio};
    use std::sync::mpsc;
    use std::time::Duration;

    const MARKER: &str = "__AME_ENV_7F3A__";
    /// Heavy shell profiles can be slow; after this the app environment is
    /// used as it is.
    const TIMEOUT: Duration = Duration::from_secs(5);

    pub fn login_env() -> Option<BTreeMap<String, String>> {
        let shell = std::env::var("SHELL")
            .ok()
            .filter(|shell| !shell.is_empty())?;
        let script = format!("printf '%s' '{MARKER}'; command env; printf '%s' '{MARKER}'");
        let mut child = Command::new(&shell)
            .args(["-l", "-i", "-c", &script])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .ok()?;
        let mut stdout = child.stdout.take()?;

        // Read until the second marker: a background process started by the
        // profile may keep stdout open, so EOF is not a reliable end.
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let mut output = Vec::new();
            let mut buffer = [0u8; 8192];
            while let Ok(read) = stdout.read(&mut buffer) {
                if read == 0 {
                    break;
                }
                output.extend_from_slice(&buffer[..read]);
                if String::from_utf8_lossy(&output).matches(MARKER).count() >= 2 {
                    break;
                }
            }
            let _ = tx.send(output);
        });

        let output = rx.recv_timeout(TIMEOUT);
        // The shell has printed everything we need; it may still be running
        // `exit` hooks, which we do not wait for.
        let _ = child.kill();
        let _ = child.wait();
        match output {
            Ok(output) => super::parse_env_output(&String::from_utf8_lossy(&output), MARKER),
            Err(_) => {
                log::warn!("capturing the environment of {shell} timed out");
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_env_output_between_markers() {
        let output = "motd noise\nMARKPATH=/usr/bin:/bin\nHOME=/home/u\nFUNC=() {\n  echo hi\n}\nEMPTY=\nMARK trailing";
        let vars = parse_env_output(output, "MARK").unwrap();
        assert_eq!(vars["PATH"], "/usr/bin:/bin");
        assert_eq!(vars["HOME"], "/home/u");
        assert_eq!(vars["FUNC"], "() {\n  echo hi\n}");
        assert_eq!(vars["EMPTY"], "");
        assert_eq!(vars.len(), 4);
    }

    #[test]
    fn missing_markers_yield_none() {
        assert!(parse_env_output("PATH=/bin", "MARK").is_none());
        assert!(parse_env_output("MARKPATH=/bin", "MARK").is_none());
    }

    #[test]
    fn names_must_be_identifiers() {
        assert!(is_name("PATH"));
        assert!(is_name("_x1"));
        assert!(!is_name("1A"));
        assert!(!is_name("A B"));
        assert!(!is_name(""));
    }

    #[test]
    fn program_names() {
        assert_eq!(program_name("/bin/zsh"), "zsh");
        assert_eq!(program_name("pwsh.exe"), "pwsh");
        assert_eq!(program_name(r"C:\Windows\System32\cmd.EXE"), "cmd");
        assert_eq!(program_name("claude"), "claude");
    }

    #[test]
    fn session_env_sets_terminal_variables() {
        let vars = session_env();
        assert!(
            vars.iter()
                .any(|(key, value)| key == "COLORTERM" && value == "truecolor")
        );
        assert!(vars.iter().any(|(key, _)| key == "TERM_PROGRAM"));
    }

    #[test]
    fn default_shell_is_not_empty() {
        let (program, _) = default_shell();
        assert!(!program.is_empty());
    }
}
