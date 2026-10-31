//! Owns all PTY sessions of the app.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use portable_pty::{CommandBuilder, PtySize, native_pty_system};

use super::session::{Session, SessionId, SessionInfo, SessionStatus, Spawned, lock};
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
}

type Listener = dyn Fn(Vec<SessionInfo>) + Send + Sync;

struct Inner {
    sessions: Mutex<BTreeMap<SessionId, Arc<Session>>>,
    next_id: AtomicU32,
    /// Called with all sessions whenever one starts, exits or is closed.
    listener: Box<Listener>,
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
        Self {
            inner: Arc::new(Inner {
                sessions: Mutex::new(BTreeMap::new()),
                next_id: AtomicU32::new(1),
                listener: Box::new(listener),
            }),
        }
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
        };
        let weak = Arc::downgrade(&self.inner);
        let session = Session::start(
            info.clone(),
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

    /// Asks the process to end; the session stays listed as exited.
    pub fn stop(&self, id: SessionId) -> Result<()> {
        self.get(id)?.kill();
        Ok(())
    }

    /// Ends the process if needed and forgets the session.
    pub fn close(&self, id: SessionId) -> Result<()> {
        let session = lock(&self.inner.sessions)
            .remove(&id)
            .ok_or(Error::UnknownSession(id))?;
        session.kill();
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
        removed.iter().for_each(|session| session.kill());
        self.inner.notify();
    }

    /// Ends every running process, e.g. when the app quits.
    pub fn shutdown(&self) {
        let sessions: Vec<_> = lock(&self.inner.sessions).values().cloned().collect();
        sessions.iter().for_each(|session| session.kill());
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

    #[test]
    fn reports_programs_that_cannot_start() {
        let (manager, _exits) = manager();
        let result = manager.spawn(spec("ame-no-such-program-4711", &[]));
        assert!(matches!(result, Err(Error::Pty(_))), "{result:?}");
        assert!(manager.list().is_empty());
    }

    #[cfg(windows)]
    #[test]
    fn runs_a_command_on_windows() {
        let (manager, exits) = manager();
        let info = manager
            .spawn(spec("cmd.exe", &["/c", "echo hello"]))
            .unwrap();
        let output = Collect::default();
        manager
            .get(info.id)
            .unwrap()
            .attach(Box::new(output.clone()));
        wait_for_exit(&exits, info.id);
        wait_until(|| output.text().contains("hello"));
    }
}
