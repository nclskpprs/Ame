//! The hook helper: `ame hook <agent>`.
//!
//! Agents run it from their hooks with the event JSON on stdin. It reads the
//! few fields Ame needs, sends them to the endpoint named in the session's
//! environment and exits. It never prints to stdout (Claude Code would add
//! that to the conversation) and always exits with 0, so a closed app or a
//! session started elsewhere never disturbs the agent.

use std::ffi::OsString;
use std::io::{self, Read};

use super::endpoint::{self, HookMessage, PROTOCOL};
use super::{HOOK_ADDR_ENV, HOOK_TOKEN_ENV, SESSION_ID_ENV, claude};

/// First argument that selects the helper instead of the app.
pub const HOOK_COMMAND: &str = "hook";
/// Hook input larger than this is not parsed.
const MAX_INPUT: u64 = 16 * 1024 * 1024;

/// Runs the helper if the arguments (without the program name) ask for it
/// and returns the exit code; `None` means: start the app.
pub fn run(mut args: impl Iterator<Item = OsString>) -> Option<i32> {
    if args.next()? != HOOK_COMMAND {
        return None;
    }
    let agent = args.next().and_then(|agent| agent.into_string().ok());
    let result = hook(
        agent.as_deref().unwrap_or_default(),
        io::stdin().lock(),
        |key| std::env::var(key).ok(),
    );
    if let Err(err) = result
        && cfg!(debug_assertions)
    {
        eprintln!("ame hook: {err}");
    }
    Some(0)
}

/// Reads one hook input from `input` and reports it. `env` looks up the
/// session's environment variables.
pub fn hook(agent: &str, input: impl Read, env: impl Fn(&str) -> Option<String>) -> io::Result<()> {
    // Read the whole input first, so the agent never writes into a closed pipe.
    let mut json = Vec::new();
    input.take(MAX_INPUT).read_to_end(&mut json)?;
    let (Some(addr), Some(token), Some(session)) = (
        env(HOOK_ADDR_ENV),
        env(HOOK_TOKEN_ENV),
        env(SESSION_ID_ENV).and_then(|id| id.parse().ok()),
    ) else {
        // Not started by Ame (e.g. the hooks were copied elsewhere).
        return Ok(());
    };
    let parsed = match agent {
        claude::AGENT => claude::parse_input(&json),
        _ => return Err(io::Error::other(format!("unknown agent {agent:?}"))),
    };
    let Some((event, detail, message)) = parsed else {
        return Err(io::Error::other("hook input without an event"));
    };
    endpoint::send(
        &addr,
        &HookMessage {
            v: PROTOCOL,
            token,
            session,
            agent: agent.to_owned(),
            event,
            detail,
            message,
        },
    )
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Mutex;
    use std::sync::mpsc;
    use std::time::Duration;

    use super::*;
    use crate::agents::adapters::endpoint::HookEndpoint;

    #[test]
    fn only_the_hook_command_runs_the_helper() {
        assert_eq!(run(std::iter::empty()), None);
        assert_eq!(run([OsString::from("--flag")].into_iter()), None);
    }

    #[test]
    fn reports_a_hook_to_the_endpoint() {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let endpoint = HookEndpoint::start(move |message| {
            let _ = tx.lock().unwrap().send(message);
        })
        .unwrap();
        let env: HashMap<&str, String> = HashMap::from([
            (HOOK_ADDR_ENV, endpoint.addr().to_string()),
            (HOOK_TOKEN_ENV, endpoint.token().to_owned()),
            (SESSION_ID_ENV, "42".to_owned()),
        ]);
        let input = br#"{"hook_event_name":"Stop","stop_hook_active":false}"#;
        hook(claude::AGENT, &input[..], |key| env.get(key).cloned()).unwrap();

        let message = rx.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_eq!(message.session, 42);
        assert_eq!(message.agent, "claude");
        assert_eq!(message.event, "Stop");
    }

    #[test]
    fn does_nothing_outside_ame_sessions() {
        let input = br#"{"hook_event_name":"Stop"}"#;
        assert!(hook(claude::AGENT, &input[..], |_| None).is_ok());
    }

    #[test]
    fn rejects_unknown_agents_and_input() {
        let env = |_: &str| Some("1".to_owned());
        assert!(hook("other", &b"{}"[..], env).is_err());
        assert!(hook(claude::AGENT, &b"garbage"[..], env).is_err());
    }
}
