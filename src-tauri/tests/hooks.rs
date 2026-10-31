//! End to end: a terminal session runs the real `ame hook claude` helper,
//! as Claude Code would from its hooks, and its state follows the hooks.

#![cfg(unix)]

use std::time::{Duration, Instant};

use ame_lib::agents::adapters::{Adapters, CLAUDE_HOOKS};
use ame_lib::agents::status::{AgentState, StatusConfig};
use ame_lib::pty::{PtyManager, SpawnSpec};

const TIMEOUT: Duration = Duration::from_secs(10);

#[test]
fn hooks_drive_the_state_of_a_session() {
    let pty = PtyManager::new(|_| {});
    let hooks = pty.clone();
    let config = tempfile::tempdir().expect("temp dir");
    let adapters = Adapters::start(config.path(), move |message| hooks.apply_hook(&message));
    let launch = adapters.launch(Some(CLAUDE_HOOKS));
    assert_eq!(launch.args.first().map(String::as_str), Some("--settings"));

    // Stands in for Claude Code: it prints output (which alone would mean
    // "working"), then reports a permission prompt through the helper.
    let helper = env!("CARGO_BIN_EXE_ame");
    let script = format!(
        "while :; do printf '.'; sleep 0.05; done & \
         echo '{{\"hook_event_name\":\"Notification\",\"notification_type\":\"permission_prompt\",\
         \"message\":\"Claude needs your permission to use Bash\"}}' | '{helper}' hook claude; \
         sleep 30"
    );
    let info = pty
        .spawn(SpawnSpec {
            project: "/project".into(),
            profile: "claude".into(),
            title: "Claude Code".into(),
            program: "/bin/sh".into(),
            args: vec!["-c".into(), script],
            cwd: std::env::temp_dir(),
            env: launch.env,
            cols: 80,
            rows: 24,
            status: StatusConfig::default(),
        })
        .expect("spawn");

    let start = Instant::now();
    loop {
        let session = pty.get(info.id).expect("session").info();
        if session.state == AgentState::NeedsInput {
            assert_eq!(
                session.attention.as_deref(),
                Some("Claude needs your permission to use Bash")
            );
            break;
        }
        assert!(
            start.elapsed() < TIMEOUT,
            "state stayed {:?}",
            session.state
        );
        std::thread::sleep(Duration::from_millis(50));
    }
    pty.shutdown();
}
