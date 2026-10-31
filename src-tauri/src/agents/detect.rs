//! Finds the programs of agent profiles on the `PATH`.

use std::path::PathBuf;

use super::profiles::AgentProfile;
use crate::pty::env;

/// Program and arguments that start a profile. The shell profile (empty
/// command) runs the user's default shell; other commands are resolved on
/// the login shell `PATH`, so a full path is used where possible.
pub fn program(profile: &AgentProfile) -> (String, Vec<String>) {
    if profile.command.trim().is_empty() {
        let (shell, mut args) = env::default_shell();
        args.extend(profile.args.iter().cloned());
        return (shell, args);
    }
    let program = resolve(&profile.command)
        .map(|path| path.display().to_string())
        .unwrap_or_else(|| profile.command.clone());
    (program, profile.args.clone())
}

/// Full path of a command, or `None` if it is not installed.
pub fn resolve(command: &str) -> Option<PathBuf> {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    which::which_in(command, env::path(), cwd).ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::profiles::{SHELL_PROFILE, builtin_profiles};

    #[test]
    fn the_shell_profile_runs_the_default_shell() {
        let shell = builtin_profiles()
            .into_iter()
            .find(|p| p.id == SHELL_PROFILE)
            .unwrap();
        let (program, _) = program(&shell);
        assert_eq!(program, env::default_shell().0);
    }

    #[test]
    fn missing_commands_are_not_resolved() {
        assert!(resolve("ame-no-such-agent-4711").is_none());
        let profile = AgentProfile {
            command: "ame-no-such-agent-4711".into(),
            ..AgentProfile::default()
        };
        assert_eq!(program(&profile).0, "ame-no-such-agent-4711");
    }

    #[cfg(unix)]
    #[test]
    fn resolves_programs_on_the_path() {
        let path = resolve("sh").expect("sh is on the PATH");
        assert!(path.is_absolute());
    }
}
