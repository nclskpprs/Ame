//! Claude Code hooks adapter.
//!
//! Claude Code is started with `--settings <file>`; the file registers the
//! Ame executable as a command hook for the events below. Claude Code merges
//! these hooks with the user's own ones, and no file in the project or the
//! user's Claude config is touched.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::{Value, json};

use super::endpoint::HookMessage;
use super::{AdapterSignal, AdapterState};
use crate::workspace::storage::write_atomic;

/// Agent name in hook messages and in `ame hook claude`.
pub const AGENT: &str = "claude";
/// File written into `<config dir>/adapters/`.
pub const SETTINGS_FILE: &str = "claude-settings.json";

/// The hook events Ame listens to. Events that fire for every tool call are
/// left out on purpose: each hook starts a process.
const EVENTS: &[&str] = &[
    "SessionStart",
    "UserPromptSubmit",
    "PreCompact",
    "Notification",
    "Stop",
];
/// Seconds Claude Code waits for the helper (it ends after about a second).
const HOOK_TIMEOUT_SECS: u32 = 10;
/// Longest notification text passed on, in characters.
const MAX_MESSAGE_CHARS: usize = 300;

/// The fields Ame reads from the JSON Claude Code passes to a hook.
#[derive(Debug, Default, Deserialize)]
struct HookInput {
    hook_event_name: Option<String>,
    /// `SessionStart`: `startup`, `resume`, `clear`, `compact`, …
    source: Option<String>,
    /// `Notification`: `permission_prompt`, `idle_prompt`, …
    notification_type: Option<String>,
    /// `PreCompact`: `manual` or `auto`.
    trigger: Option<String>,
    message: Option<String>,
}

/// The `(event, detail, message)` of a hook input, `None` if it has no event
/// name.
pub fn parse_input(json: &[u8]) -> Option<(String, Option<String>, Option<String>)> {
    let input: HookInput = serde_json::from_slice(json).ok()?;
    let event = input.hook_event_name?;
    let detail = input.notification_type.or(input.source).or(input.trigger);
    let message = input
        .message
        .map(|text| text.chars().take(MAX_MESSAGE_CHARS).collect::<String>())
        .filter(|text| !text.trim().is_empty());
    Some((event, detail, message))
}

/// Maps a Claude Code hook event to a status signal.
pub fn signal(message: &HookMessage, current: Option<AdapterState>) -> Option<AdapterSignal> {
    let detail = message.detail.as_deref();
    match message.event.as_str() {
        "UserPromptSubmit" | "PreCompact" => Some(AdapterSignal::Working),
        "Stop" => Some(AdapterSignal::Idle),
        // After a compaction Claude Code may simply carry on.
        "SessionStart" if detail != Some("compact") => Some(AdapterSignal::Idle),
        "Notification" => notification(detail, message.message.clone(), current),
        _ => None,
    }
}

fn notification(
    kind: Option<&str>,
    message: Option<String>,
    current: Option<AdapterState>,
) -> Option<AdapterSignal> {
    match kind {
        Some(
            "permission_prompt"
            | "elicitation_dialog"
            | "elicitation_url_dialog"
            | "agent_needs_input",
        ) => Some(AdapterSignal::NeedsInput(message)),
        // Older versions send no type: a notification while working is a
        // question, one while idle is the reminder that the prompt waits.
        None if current != Some(AdapterState::Idle) => Some(AdapterSignal::NeedsInput(message)),
        // `idle_prompt` repeats what Stop already said; the others
        // (`auth_success`, quota and plugin notices, …) need no answer.
        _ => None,
    }
}

/// The settings JSON with the Ame hooks for the executable `exe`.
pub fn settings(exe: &Path) -> Value {
    let hook = json!([{
        "hooks": [{
            "type": "command",
            "command": hook_command(exe),
            "timeout": HOOK_TIMEOUT_SECS,
        }]
    }]);
    let hooks: serde_json::Map<String, Value> = EVENTS
        .iter()
        .map(|event| ((*event).to_owned(), hook.clone()))
        .collect();
    json!({ "hooks": hooks })
}

/// Writes the settings file into `dir` (only when its content changed) and
/// returns its path.
pub fn write_settings(dir: &Path, exe: &Path) -> io::Result<PathBuf> {
    let path = dir.join(SETTINGS_FILE);
    let mut text = serde_json::to_string_pretty(&settings(exe))?;
    text.push('\n');
    if fs::read_to_string(&path).is_ok_and(|current| current == text) {
        return Ok(path);
    }
    fs::create_dir_all(dir)?;
    write_atomic(&path, text.as_bytes())?;
    Ok(path)
}

/// The shell command of the hook. Claude Code runs it with `sh -c` on macOS
/// and Linux and with Git Bash on Windows.
fn hook_command(exe: &Path) -> String {
    format!("{} hook {AGENT}", quote(&exe.display().to_string()))
}

#[cfg(not(windows))]
fn quote(path: &str) -> String {
    format!("'{}'", path.replace('\'', r"'\''"))
}

/// Windows paths cannot contain `"`; forward slashes keep Git Bash from
/// reading backslashes as escapes.
#[cfg(windows)]
fn quote(path: &str) -> String {
    format!("\"{}\"", path.replace('\\', "/"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::agents::adapters::endpoint::PROTOCOL;

    fn hook(event: &str, detail: Option<&str>) -> HookMessage {
        HookMessage {
            v: PROTOCOL,
            token: String::new(),
            session: 1,
            agent: AGENT.into(),
            event: event.into(),
            detail: detail.map(str::to_owned),
            message: Some("Claude needs your permission to use Bash".into()),
        }
    }

    #[test]
    fn parses_the_fields_ame_needs() {
        let input = br#"{"session_id":"abc","hook_event_name":"Notification",
            "message":"Claude needs your permission","title":"Permission needed",
            "notification_type":"permission_prompt","cwd":"/x"}"#;
        assert_eq!(
            parse_input(input),
            Some((
                "Notification".into(),
                Some("permission_prompt".into()),
                Some("Claude needs your permission".into())
            ))
        );
        let start = br#"{"hook_event_name":"SessionStart","source":"resume","model":"m"}"#;
        assert_eq!(
            parse_input(start),
            Some(("SessionStart".into(), Some("resume".into()), None))
        );
        assert_eq!(parse_input(br#"{"prompt":"hi"}"#), None);
        assert_eq!(parse_input(b"not json"), None);
        let long = format!(
            r#"{{"hook_event_name":"Notification","message":"{}"}}"#,
            "x".repeat(1000)
        );
        let (_, _, message) = parse_input(long.as_bytes()).unwrap();
        assert_eq!(message.unwrap().len(), MAX_MESSAGE_CHARS);
    }

    #[test]
    fn maps_events_to_signals() {
        let working = Some(AdapterState::Working);
        assert_eq!(
            signal(&hook("UserPromptSubmit", None), None),
            Some(AdapterSignal::Working)
        );
        assert_eq!(
            signal(&hook("PreCompact", Some("auto")), None),
            Some(AdapterSignal::Working)
        );
        assert_eq!(
            signal(&hook("Stop", None), working),
            Some(AdapterSignal::Idle)
        );
        assert_eq!(
            signal(&hook("SessionStart", Some("startup")), None),
            Some(AdapterSignal::Idle)
        );
        assert_eq!(
            signal(&hook("SessionStart", Some("compact")), working),
            None
        );
        assert_eq!(signal(&hook("SubagentStop", None), working), None);
    }

    #[test]
    fn notifications_ask_only_when_they_need_an_answer() {
        let ask = Some(AdapterSignal::NeedsInput(Some(
            "Claude needs your permission to use Bash".into(),
        )));
        let idle = Some(AdapterState::Idle);
        let working = Some(AdapterState::Working);
        assert_eq!(
            signal(&hook("Notification", Some("permission_prompt")), idle),
            ask
        );
        assert_eq!(
            signal(&hook("Notification", Some("elicitation_dialog")), working),
            ask
        );
        assert_eq!(
            signal(&hook("Notification", Some("idle_prompt")), idle),
            None
        );
        assert_eq!(
            signal(&hook("Notification", Some("auth_success")), working),
            None
        );
        // Without a type it depends on what Claude Code was doing.
        assert_eq!(signal(&hook("Notification", None), working), ask);
        assert_eq!(signal(&hook("Notification", None), idle), None);
    }

    #[test]
    fn settings_register_the_helper_for_each_event() {
        let settings = settings(Path::new("/opt/Ame it's/ame"));
        let hooks = settings["hooks"].as_object().unwrap();
        assert_eq!(hooks.len(), EVENTS.len());
        let entry = &hooks["Stop"][0]["hooks"][0];
        assert_eq!(entry["type"], "command");
        assert_eq!(entry["timeout"], HOOK_TIMEOUT_SECS);
        #[cfg(not(windows))]
        assert_eq!(entry["command"], r"'/opt/Ame it'\''s/ame' hook claude");
    }

    #[cfg(windows)]
    #[test]
    fn windows_paths_use_forward_slashes() {
        assert_eq!(
            hook_command(Path::new(r"C:\Program Files\Ame\ame.exe")),
            r#""C:/Program Files/Ame/ame.exe" hook claude"#
        );
    }

    #[test]
    fn writes_the_settings_file_only_when_it_changes() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("adapters");
        let path = write_settings(&target, Path::new("/usr/bin/ame")).unwrap();
        let written: Value = serde_json::from_str(&fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(written, settings(Path::new("/usr/bin/ame")));
        let modified = fs::metadata(&path).unwrap().modified().unwrap();
        write_settings(&target, Path::new("/usr/bin/ame")).unwrap();
        assert_eq!(fs::metadata(&path).unwrap().modified().unwrap(), modified);
        write_settings(&target, Path::new("/opt/ame")).unwrap();
        assert!(fs::read_to_string(&path).unwrap().contains("/opt/ame"));
    }
}
