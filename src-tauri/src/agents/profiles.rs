//! Agent profiles: which command starts an agent and how to resume it.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use specta::Type;

use super::adapters::CLAUDE_HOOKS;

/// Id of the profile that starts the user's default shell.
pub const SHELL_PROFILE: &str = "shell";

/// How to start an agent (or a shell) in a terminal session.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase", default)]
pub struct AgentProfile {
    /// Stable id, e.g. `claude`. A custom profile with the id of a built-in
    /// one replaces it.
    pub id: String,
    /// Display name, e.g. `Claude Code`.
    pub name: String,
    /// Program to run, looked up on the `PATH`. Empty for the default shell.
    pub command: String,
    pub args: Vec<String>,
    /// Extra environment variables.
    pub env: BTreeMap<String, String>,
    /// Arguments that continue the last conversation instead of starting a
    /// new one, e.g. `["--continue"]`. Empty when the agent cannot resume.
    pub resume_args: Vec<String>,
    /// Regular expressions for text that means the agent waits for an answer
    /// (e.g. a permission prompt). Common yes/no prompts are always detected.
    pub needs_input_patterns: Vec<String>,
    /// Milliseconds without output after which the agent counts as idle.
    pub idle_after_ms: Option<u32>,
    /// Precise status adapter, e.g. `claude-hooks` (see
    /// `agents::adapters`). `None` uses the heuristics only.
    pub adapter: Option<String>,
}

fn profile(
    id: &str,
    name: &str,
    command: &str,
    resume_args: &[&str],
    patterns: &[&str],
) -> AgentProfile {
    let strings = |items: &[&str]| items.iter().map(|item| (*item).to_owned()).collect();
    AgentProfile {
        id: id.to_owned(),
        name: name.to_owned(),
        command: command.to_owned(),
        resume_args: strings(resume_args),
        needs_input_patterns: strings(patterns),
        ..AgentProfile::default()
    }
}

/// The profiles Ame knows out of the box.
pub fn builtin_profiles() -> Vec<AgentProfile> {
    vec![
        AgentProfile {
            adapter: Some(CLAUDE_HOOKS.to_owned()),
            ..profile(
                "claude",
                "Claude Code",
                "claude",
                &["--continue"],
                &["Do you want to", r"❯ 1\. Yes", "Would you like to"],
            )
        },
        profile(
            "codex",
            "Codex CLI",
            "codex",
            &["resume", "--last"],
            &["Would you like to", "Yes, proceed", "Allow command"],
        ),
        profile(
            "gemini",
            "Gemini CLI",
            "gemini",
            &["--resume"],
            &[
                "Allow execution",
                "Apply this change",
                "Waiting for user confirmation",
            ],
        ),
        profile(
            "opencode",
            "OpenCode",
            "opencode",
            &["--continue"],
            &["Permission required", "Allow once"],
        ),
        profile(
            "aider",
            "Aider",
            "aider",
            &["--restore-chat-history"],
            &[r"\(Y\)es/\(N\)o"],
        ),
        profile(SHELL_PROFILE, "Shell", "", &[], &[]),
    ]
}

/// Built-in profiles with the custom ones from the settings applied: a custom
/// profile replaces the built-in one with the same id, others are added
/// before the shell. Custom profiles without an id or a command are ignored.
/// A replacement without an `adapter` keeps the one of the built-in profile.
pub fn merged_profiles(custom: &[AgentProfile]) -> Vec<AgentProfile> {
    let mut profiles = builtin_profiles();
    for profile in custom {
        if profile.id.trim().is_empty()
            || (profile.command.trim().is_empty() && profile.id != SHELL_PROFILE)
        {
            continue;
        }
        let mut profile = profile.clone();
        if profile.name.trim().is_empty() {
            profile.name.clone_from(&profile.id);
        }
        if let Some(existing) = profiles.iter_mut().find(|p| p.id == profile.id) {
            // Profiles saved before the adapter existed keep the built-in
            // one; an empty string turns it off.
            if profile.adapter.is_none() {
                profile.adapter = existing.adapter.take();
            }
            *existing = profile;
        } else {
            let shell = profiles
                .iter()
                .position(|p| p.id == SHELL_PROFILE)
                .unwrap_or(profiles.len());
            profiles.insert(shell, profile);
        }
    }
    profiles
}

/// Whether a profile can continue the last conversation.
pub fn can_resume(profile: &AgentProfile) -> bool {
    !profile.resume_args.is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_profiles_have_unique_ids_and_end_with_the_shell() {
        let profiles = builtin_profiles();
        let mut ids: Vec<_> = profiles.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids.last(), Some(&SHELL_PROFILE));
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), profiles.len());
        assert!(can_resume(&profiles[0]));
        assert_eq!(profiles[0].adapter.as_deref(), Some(CLAUDE_HOOKS));
        for profile in &profiles {
            for pattern in &profile.needs_input_patterns {
                assert!(regex::Regex::new(pattern).is_ok(), "{pattern}");
            }
        }
    }

    #[test]
    fn custom_profiles_replace_or_extend_the_builtin_ones() {
        let custom = vec![
            AgentProfile {
                id: "claude".into(),
                name: "Claude (work)".into(),
                command: "claude".into(),
                args: vec!["--model".into(), "opus".into()],
                ..AgentProfile::default()
            },
            AgentProfile {
                id: "mine".into(),
                command: "my-agent".into(),
                ..AgentProfile::default()
            },
            AgentProfile {
                id: "broken".into(),
                ..AgentProfile::default()
            },
        ];
        let profiles = merged_profiles(&custom);
        let claude = profiles.iter().find(|p| p.id == "claude").unwrap();
        assert_eq!(claude.name, "Claude (work)");
        assert_eq!(claude.adapter.as_deref(), Some(CLAUDE_HOOKS));
        assert!(!can_resume(claude));
        let ids: Vec<_> = profiles.iter().map(|p| p.id.as_str()).collect();
        assert_eq!(ids[ids.len() - 2..], ["mine", SHELL_PROFILE]);
        assert!(!ids.contains(&"broken"));
        assert_eq!(profiles[ids.len() - 2].name, "mine");
    }
}
