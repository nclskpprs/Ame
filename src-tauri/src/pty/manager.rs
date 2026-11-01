//! Owns all PTY sessions of the app.

use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex, Weak};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use portable_pty::{CommandBuilder, PtySize, native_pty_system};

use super::session::{Session, SessionId, SessionInfo, SessionStatus, Spawned, lock};
use super::tree;
use crate::agents::adapters::endpoint::HookMessage;
use crate::agents::cpu::CpuMonitor;
use crate::agents::queue::{PromptQueue, QueuedPrompt};
use crate::agents::status::{AgentState, StatusConfig};
use crate::error::{Error, Result};

/// What to run in a new session.
#[derive(Debug, Clone)]
pub struct SpawnSpec {
    pub project: String,
    pub profile: String,
    pub title: String,
    pub program: String,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    /// Variables added to (or replacing) the app's own environment.
    pub env: Vec<(String, String)>,
    pub cols: u16,
    pub rows: u16,
    pub status: StatusConfig,
    /// Other project folders the agent was given (group sessions).
    pub dirs: Vec<String>,
}

/// How often agent states are re-evaluated.
const STATUS_TICK: Duration = Duration::from_millis(250);
/// CPU use is measured every this many ticks (sysinfo walks all processes).
const CPU_TICKS: u32 = 8;
/// Percent of one core above which a process tree counts as busy.
const CPU_BUSY: f32 = 10.0;

type Listener = dyn Fn(Vec<SessionInfo>) + Send + Sync;
type PromptListener = dyn Fn(&SessionInfo) + Send + Sync;

struct Inner {
    sessions: Mutex<BTreeMap<SessionId, Arc<Session>>>,
    next_id: AtomicU32,
    /// Called with all sessions whenever one starts, exits or is closed.
    listener: Box<Listener>,
    /// Called when a session submitted a prompt (seen by the status loop).
    prompt_listener: Mutex<Option<Box<PromptListener>>>,
}

impl Inner {
    fn list(&self) -> Vec<SessionInfo> {
        lock(&self.sessions)
            .values()
            .map(|session| session.info())
            .collect()
    }

    fn notify(&self) {
        (self.listener)(self.list());
    }
}

/// Managed as Tauri state; cheap to clone.
#[derive(Clone)]
pub struct PtyManager {
    inner: Arc<Inner>,
}

impl PtyManager {
    pub fn new(listener: impl Fn(Vec<SessionInfo>) + Send + Sync + 'static) -> Self {
        let inner = Arc::new(Inner {
            sessions: Mutex::new(BTreeMap::new()),
            next_id: AtomicU32::new(1),
            listener: Box::new(listener),
            prompt_listener: Mutex::new(None),
        });
        let weak = Arc::downgrade(&inner);
        let spawned = std::thread::Builder::new()
            .name("agent-status".into())
            .spawn(move || status_loop(&weak));
        if let Err(err) = spawned {
            log::warn!("could not start the agent status thread: {err}");
        }
        Self { inner }
    }

    /// Calls `listener` whenever a session submitted a prompt, at most a
    /// status tick (250 ms) later, e.g. to take a checkpoint.
    pub fn on_prompt(&self, listener: impl Fn(&SessionInfo) + Send + Sync + 'static) {
        *lock(&self.inner.prompt_listener) = Some(Box::new(listener));
    }

    pub fn spawn(&self, spec: SpawnSpec) -> Result<SessionInfo> {
        let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
        let pair = native_pty_system()
            .openpty(PtySize {
                rows: spec.rows.max(1),
                cols: spec.cols.max(1),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(pty_error)?;

        let mut command = CommandBuilder::new(&spec.program);
        command.args(&spec.args);
        command.cwd(&spec.cwd);
        for (key, value) in &spec.env {
            command.env(key, value);
        }
        command.env("AME_SESSION_ID", id.to_string());

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|err| Error::Pty(format!("could not start {}: {err}", spec.program)))?;
        // Only the child may keep the slave side open, or the reader never
        // sees the end of the output on Unix.
        drop(pair.slave);
        let reader = pair.master.try_clone_reader().map_err(pty_error)?;
        let writer = pair.master.take_writer().map_err(pty_error)?;

        let info = SessionInfo {
            id,
            project: spec.project,
            profile: spec.profile,
            title: spec.title,
            pid: child.process_id(),
            started_at: now_ms(),
            status: SessionStatus::Running,
            state: AgentState::Starting,
            attention: None,
            queue: Vec::new(),
            prompts: 0,
            intensity: 1,
            dirs: spec.dirs.clone(),
        };
        let weak = Arc::downgrade(&self.inner);
        let session = Session::start(
            info.clone(),
            spec.status,
            Spawned {
                master: pair.master,
                child,
                reader,
                writer,
            },
            move || {
                if let Some(inner) = weak.upgrade() {
                    inner.notify();
                }
            },
        )?;
        lock(&self.inner.sessions).insert(id, session);
        self.inner.notify();
        Ok(info)
    }

    pub fn list(&self) -> Vec<SessionInfo> {
        self.inner.list()
    }

    pub fn get(&self, id: SessionId) -> Result<Arc<Session>> {
        lock(&self.inner.sessions)
            .get(&id)
            .cloned()
            .ok_or(Error::UnknownSession(id))
    }

    /// Applies a message of an adapter hook to its session. Messages for
    /// unknown or exited sessions are ignored.
    pub fn apply_hook(&self, message: &HookMessage) {
        let Ok(session) = self.get(message.session) else {
            return;
        };
        if session.is_running() && session.apply_hook(message, Instant::now()) {
            self.inner.notify();
        }
    }

    /// Queues a follow-up prompt for a session (see `agents::queue`).
    pub fn queue_prompt(&self, id: SessionId, text: &str) -> Result<QueuedPrompt> {
        let prompt = self.get(id)?.queue_prompt(text)?;
        self.inner.notify();
        Ok(prompt)
    }

    /// Changes a session's queue and reports the change.
    pub fn edit_queue(
        &self,
        id: SessionId,
        edit: impl FnOnce(&mut PromptQueue) -> bool,
    ) -> Result<()> {
        if self.get(id)?.edit_queue(edit) {
            self.inner.notify();
        }
        Ok(())
    }

    /// Asks the process to end; the session stays listed as exited.
    pub fn stop(&self, id: SessionId) -> Result<()> {
        end_sessions(&[self.get(id)?]);
        Ok(())
    }

    /// Ends the process if needed and forgets the session.
    pub fn close(&self, id: SessionId) -> Result<()> {
        let session = lock(&self.inner.sessions)
            .remove(&id)
            .ok_or(Error::UnknownSession(id))?;
        end_sessions(&[session]);
        self.inner.notify();
        Ok(())
    }

    /// Closes all sessions of a project.
    pub fn close_project(&self, project: &str) {
        let removed: Vec<_> = {
            let mut sessions = lock(&self.inner.sessions);
            let ids: Vec<_> = sessions
                .iter()
                .filter(|(_, session)| session.info().project == project)
                .map(|(id, _)| *id)
                .collect();
            ids.iter().filter_map(|id| sessions.remove(id)).collect()
        };
        if removed.is_empty() {
            return;
        }
        end_sessions(&removed);
        self.inner.notify();
    }

    /// Ends every running process, e.g. when the app quits.
    pub fn shutdown(&self) {
        let sessions: Vec<_> = lock(&self.inner.sessions).values().cloned().collect();
        end_sessions(&sessions);
    }
}

/// Ends the programs of the sessions and everything they started. The
/// descendants go first: once a session's program ended, they belong to the
/// init process and can no longer be found.
fn end_sessions(sessions: &[Arc<Session>]) {
    let roots: Vec<_> = sessions
        .iter()
        .filter(|session| session.is_running())
        .filter_map(|session| session.pid())
        .collect();
    tree::end_descendants(&roots);
    sessions.iter().for_each(|session| session.kill());
}

/// Re-evaluates the agent states and reports changes. Ends with the manager.
fn status_loop(inner: &Weak<Inner>) {
    let mut cpu = CpuMonitor::default();
    let mut tick: u32 = 0;
    // Prompts per session at the last tick.
    let mut prompts: HashMap<SessionId, u32> = HashMap::new();
    loop {
        std::thread::sleep(STATUS_TICK);
        let Some(inner) = inner.upgrade() else { break };
        let sessions: Vec<_> = lock(&inner.sessions).values().cloned().collect();
        if tick.is_multiple_of(CPU_TICKS) {
            let running: Vec<_> = sessions
                .iter()
                .filter(|session| session.is_running())
                .filter_map(|session| session.pid().map(|pid| (session, pid)))
                .collect();
            if !running.is_empty() {
                let pids: Vec<_> = running.iter().map(|(_, pid)| *pid).collect();
                let usage = cpu.tree_usage(&pids);
                for (session, pid) in running {
                    let tree = usage.get(&pid).copied().unwrap_or_default();
                    session.set_cpu_busy(tree.cpu > CPU_BUSY);
                    session.set_usage(tree);
                }
            }
        }
        let now = Instant::now();
        // Every session is refreshed, so no short-circuiting `any`.
        let mut changed = false;
        for session in &sessions {
            changed |= session.refresh_state(now);
            if let Some(prompt) = session.take_due_prompt(now) {
                changed = true;
                submit_in_background(Arc::clone(session), prompt.text);
            }
        }
        if changed {
            inner.notify();
        }
        report_prompts(&inner, &sessions, &mut prompts);
        tick = tick.wrapping_add(1);
    }
}

/// Calls the prompt listener for every session whose prompt count grew.
fn report_prompts(inner: &Inner, sessions: &[Arc<Session>], seen: &mut HashMap<SessionId, u32>) {
    let listener = lock(&inner.prompt_listener);
    let mut current = HashMap::with_capacity(sessions.len());
    for session in sessions {
        let info = session.info();
        if seen
            .get(&info.id)
            .is_some_and(|&before| info.prompts > before)
            && let Some(listener) = listener.as_ref()
        {
            listener(&info);
        }
        current.insert(info.id, info.prompts);
    }
    *seen = current;
}

/// Sends a queued prompt without blocking the status loop.
fn submit_in_background(session: Arc<Session>, text: String) {
    let spawned = std::thread::Builder::new()
        .name("prompt-queue".into())
        .spawn(move || {
            if let Err(err) = session.submit(&text) {
                log::warn!("could not send a queued prompt: {err}");
            }
        });
    if let Err(err) = spawned {
        log::warn!("could not start the prompt thread: {err}");
    }
}

fn pty_error(err: impl std::fmt::Display) -> Error {
    Error::Pty(err.to_string())
}

fn now_ms() -> f64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as f64)
        .unwrap_or(0.0)
}

#[cfg(test)]
mod tests {
    use std::sync::mpsc;
    use std::time::Duration;

    use super::*;
    use crate::pty::session::OutputSink;

    const TIMEOUT: Duration = Duration::from_secs(10);

    #[derive(Clone, Default)]
    struct Collect(Arc<Mutex<String>>);

    impl OutputSink for Collect {
        fn send(&self, text: String) -> bool {
            lock(&self.0).push_str(&text);
            true
        }
    }

    impl Collect {
        fn text(&self) -> String {
            lock(&self.0).clone()
        }
    }

    /// A manager that reports every exit through a channel.
    fn manager() -> (PtyManager, mpsc::Receiver<SessionInfo>) {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let manager = PtyManager::new(move |sessions| {
            for session in sessions {
                if session.status != SessionStatus::Running {
                    let _ = lock(&tx).send(session);
                }
            }
        });
        (manager, rx)
    }

    fn spec(program: &str, args: &[&str]) -> SpawnSpec {
        SpawnSpec {
            project: "/project".into(),
            profile: "test".into(),
            title: "Test".into(),
            program: program.into(),
            args: args.iter().map(|arg| (*arg).to_owned()).collect(),
            cwd: std::env::temp_dir(),
            env: Vec::new(),
            cols: 80,
            rows: 24,
            status: StatusConfig::default(),
            dirs: Vec::new(),
        }
    }

    fn wait_for_exit(exits: &mpsc::Receiver<SessionInfo>, id: SessionId) -> SessionStatus {
        loop {
            let info = exits.recv_timeout(TIMEOUT).expect("session did not exit");
            if info.id == id {
                return info.status;
            }
        }
    }

    #[cfg(unix)]
    fn wait_until(mut condition: impl FnMut() -> bool) {
        let start = std::time::Instant::now();
        while !condition() {
            assert!(start.elapsed() < TIMEOUT, "condition not met in time");
            std::thread::sleep(Duration::from_millis(20));
        }
    }

    #[cfg(unix)]
    #[test]
    fn streams_output_and_reports_the_exit_code() {
        let (manager, exits) = manager();
        let info = manager
            .spawn(spec(
                "/bin/sh",
                &["-c", "sleep 0.2; printf 'hello'; exit 3"],
            ))
            .unwrap();
        let output = Collect::default();
        manager
            .get(info.id)
            .unwrap()
            .attach(Box::new(output.clone()));
        assert_eq!(
            wait_for_exit(&exits, info.id),
            SessionStatus::Exited {
                exit_code: 3,
                signal: None
            }
        );
        assert!(output.text().contains("hello"), "{:?}", output.text());
    }

    #[cfg(unix)]
    #[test]
    fn replays_buffered_output_and_tracks_modes() {
        let (manager, exits) = manager();
        let info = manager
            .spawn(spec("/bin/sh", &["-c", r"printf 'one\ntwo\033[?2004h'"]))
            .unwrap();
        wait_for_exit(&exits, info.id);
        let session = manager.get(info.id).unwrap();
        let output = Collect::default();
        session.attach(Box::new(output.clone()));
        assert!(
            output.text().starts_with("one\r\ntwo"),
            "{:?}",
            output.text()
        );
        assert!(session.bracketed_paste());
        assert!(session.write(b"x").is_err(), "writing to an exited session");
    }

    #[cfg(unix)]
    #[test]
    fn forwards_input() {
        let (manager, exits) = manager();
        let info = manager
            .spawn(spec("/bin/sh", &["-c", "read line; echo \"got:$line\""]))
            .unwrap();
        let session = manager.get(info.id).unwrap();
        let output = Collect::default();
        session.attach(Box::new(output.clone()));
        session.write(b"abc\n").unwrap();
        wait_for_exit(&exits, info.id);
        wait_until(|| output.text().contains("got:abc"));
    }

    #[cfg(unix)]
    #[test]
    fn stop_and_close() {
        let (manager, exits) = manager();
        let info = manager.spawn(spec("/bin/sh", &["-c", "sleep 30"])).unwrap();
        assert!(manager.get(info.id).unwrap().is_running());
        manager.stop(info.id).unwrap();
        assert!(matches!(
            wait_for_exit(&exits, info.id),
            SessionStatus::Exited { .. }
        ));
        assert_eq!(manager.list().len(), 1);
        manager.close(info.id).unwrap();
        assert!(manager.list().is_empty());
        assert!(matches!(
            manager.close(info.id),
            Err(Error::UnknownSession(_))
        ));
    }

    #[cfg(unix)]
    #[test]
    fn closing_ends_what_the_program_started() {
        let (manager, _exits) = manager();
        let dir = tempfile::tempdir().unwrap();
        let pid_file = dir.path().join("pid");
        // A new session escapes the hangup of the terminal, like a daemonized
        // server. Perl's `setsid`, because macOS has no `setsid` command.
        let script = format!(
            "perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' sleep 300 & echo $! > '{}'; sleep 300",
            pid_file.display()
        );
        let info = manager.spawn(spec("/bin/sh", &["-c", &script])).unwrap();
        wait_until(|| std::fs::read_to_string(&pid_file).is_ok_and(|s| s.ends_with('\n')));
        let pid: u32 = std::fs::read_to_string(&pid_file)
            .unwrap()
            .trim()
            .parse()
            .unwrap();
        // `ps` instead of `/proc`, which macOS lacks. No output means the
        // process is gone; a state starting with `Z` is a zombie.
        let alive = |pid: u32| {
            std::process::Command::new("ps")
                .args(["-o", "stat=", "-p", &pid.to_string()])
                .output()
                .is_ok_and(|out| {
                    let stat = String::from_utf8_lossy(&out.stdout);
                    let stat = stat.trim();
                    !stat.is_empty() && !stat.starts_with('Z')
                })
        };
        assert!(alive(pid));
        manager.close(info.id).unwrap();
        wait_until(|| !alive(pid));
    }

    #[cfg(unix)]
    #[test]
    fn close_project_closes_only_its_sessions() {
        let (manager, _exits) = manager();
        let first = manager.spawn(spec("/bin/sh", &["-c", "sleep 30"])).unwrap();
        let mut other = spec("/bin/sh", &["-c", "sleep 30"]);
        other.project = "/other".into();
        let second = manager.spawn(other).unwrap();
        manager.close_project("/project");
        let left: Vec<_> = manager.list().into_iter().map(|s| s.id).collect();
        assert_eq!(left, vec![second.id]);
        assert!(manager.get(first.id).is_err());
        manager.shutdown();
    }

    #[cfg(unix)]
    #[test]
    fn detects_a_question_and_its_answer() {
        let (manager, _exits) = manager();
        let info = manager
            .spawn(spec(
                "/bin/sh",
                &["-c", "printf 'Overwrite? [y/N] '; read answer; sleep 30"],
            ))
            .unwrap();
        let state = || manager.get(info.id).unwrap().info().state;
        wait_until(|| state() == AgentState::NeedsInput);
        manager.get(info.id).unwrap().write(b"y\r").unwrap();
        wait_until(|| state() != AgentState::NeedsInput);
        manager.close(info.id).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn sends_queued_prompts_when_idle() {
        let (manager, _exits) = manager();
        let mut spec = spec(
            "/bin/sh",
            &["-c", "printf '> '; read a; echo \"got:$a\"; sleep 30"],
        );
        spec.status = StatusConfig::new(Some(500), &[]);
        let info = manager.spawn(spec).unwrap();
        let session = manager.get(info.id).unwrap();
        let output = Collect::default();
        session.attach(Box::new(output.clone()));
        manager.queue_prompt(info.id, "first").unwrap();
        manager.queue_prompt(info.id, "second").unwrap();
        assert_eq!(session.info().queue.len(), 2);
        wait_until(|| output.text().contains("got:first"));
        // The next prompt waits until the agent was seen working; the quick
        // reply of `read` looks like an echo, so it stays queued for now.
        let queue = session.info().queue;
        assert_eq!(queue.len(), 1);
        assert_eq!(queue[0].text, "second");
        assert!(manager.queue_prompt(info.id, " ").is_err());
        manager.close(info.id).unwrap();
    }

    #[cfg(unix)]
    #[test]
    fn reports_submitted_prompts() {
        let (manager, _exits) = manager();
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        manager.on_prompt(move |session| {
            let _ = lock(&tx).send((session.id, session.prompts));
        });
        let info = manager
            .spawn(spec("/bin/sh", &["-c", "read a; sleep 30"]))
            .unwrap();
        // Let the status loop see the session once before the prompt.
        std::thread::sleep(Duration::from_millis(400));
        manager
            .get(info.id)
            .unwrap()
            .write(b"fix the tests\r")
            .unwrap();
        assert_eq!(rx.recv_timeout(TIMEOUT).unwrap(), (info.id, 1));
        manager.close(info.id).unwrap();
    }

    #[test]
    fn reports_programs_that_cannot_start() {
        let (manager, _exits) = manager();
        let result = manager.spawn(spec("ame-no-such-program-4711", &[]));
        assert!(matches!(result, Err(Error::Pty(_))), "{result:?}");
        assert!(manager.list().is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn a_hidden_session_answers_cursor_position_requests() {
        let (manager, exits) = manager();
        let script =
            "stty -icanon -echo; printf 'ask\\033[6n'; head -c 6 > /dev/null; echo answered";
        let info = manager.spawn(spec("/bin/sh", &["-c", script])).unwrap();
        assert!(matches!(
            wait_for_exit(&exits, info.id),
            SessionStatus::Exited { exit_code: 0, .. }
        ));
        let output = Collect::default();
        manager
            .get(info.id)
            .unwrap()
            .attach(Box::new(output.clone()));
        let text = output.text();
        assert!(text.contains("answered"), "{text:?}");
        assert!(!text.contains("\x1b[6n"), "{text:?}");
    }

    #[cfg(windows)]
    #[test]
    fn runs_a_command_on_windows() {
        let (manager, exits) = manager();
        let info = manager
            .spawn(spec("cmd.exe", &["/c", "echo hello"]))
            .unwrap();
        // No view while it runs: the session itself answers ConPTY's cursor
        // position request, otherwise the program never starts.
        wait_for_exit(&exits, info.id);
        let output = Collect::default();
        manager
            .get(info.id)
            .unwrap()
            .attach(Box::new(output.clone()));
        let text = output.text();
        assert!(text.contains("hello"), "{text:?}");
        assert!(!text.contains("\x1b[6n"), "{text:?}");
    }
}
