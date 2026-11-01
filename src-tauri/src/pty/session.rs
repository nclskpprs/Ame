//! One PTY session: the child process, its output buffer and the threads
//! that move data between the PTY and the UI.

use std::io::{Read, Write};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant};

use portable_pty::{Child, ChildKiller, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::modes::ModeTracker;
use super::ring::RingBuffer;
use super::utf8::Utf8Decoder;
use crate::agents::adapters::{self, endpoint::HookMessage};
use crate::agents::cpu::TreeUsage;
use crate::agents::queue::{PromptQueue, QueueRejection, QueuedPrompt};
use crate::agents::status::{AgentState, StatusConfig, StatusTracker};
use crate::error::{Error, Result};

/// Bytes of output kept per session for replays.
pub const SCROLLBACK_BYTES: usize = 1024 * 1024;
/// Minimum time between two output batches sent to the UI (about 60 per
/// second at most).
const THROTTLE: Duration = Duration::from_millis(16);
/// Upper bound of one output batch.
const MAX_BATCH: usize = 256 * 1024;
/// How long to wait for the last output after the process exited.
const DRAIN_TIMEOUT: Duration = Duration::from_millis(500);
const READ_BUFFER: usize = 64 * 1024;
/// Pause between pasting a queued prompt and pressing Enter, so programs
/// that handle the paste asynchronously see the whole text first.
const SUBMIT_DELAY: Duration = Duration::from_millis(150);

pub type SessionId = u32;

/// Receives the output of an attached terminal view.
pub trait OutputSink: Send {
    /// Returns `false` when the receiver is gone.
    fn send(&self, text: String) -> bool;
}

/// Public information about a session, sent to the frontend.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: SessionId,
    /// Path of the project the session belongs to.
    pub project: String,
    /// Id of the agent profile that started it.
    pub profile: String,
    /// Display title, e.g. the agent name.
    pub title: String,
    /// Process id of the agent or shell.
    pub pid: Option<u32>,
    /// Start time in milliseconds since the Unix epoch.
    pub started_at: f64,
    pub status: SessionStatus,
    /// What the agent is doing, from output, input and exit.
    pub state: AgentState,
    /// Text of the last terminal notification (OSC 9 / 777) not answered yet.
    pub attention: Option<String>,
    /// Follow-up prompts sent one by one whenever the agent is idle.
    pub queue: Vec<QueuedPrompt>,
    /// Prompts submitted so far; the frontend lets a drop fall on each new one.
    pub prompts: u32,
    /// How heavily the agent prints while working, 1 (light) to 3 (heavy).
    pub intensity: u8,
    /// Other project folders the agent was given (group sessions).
    pub dirs: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(tag = "state", rename_all = "camelCase")]
pub enum SessionStatus {
    Running,
    #[serde(rename_all = "camelCase")]
    Exited {
        exit_code: u32,
        /// Name of the signal that ended the process (Unix).
        signal: Option<String>,
    },
}

struct Attached {
    token: u32,
    sink: Box<dyn OutputSink>,
    decoder: Utf8Decoder,
}

struct Output {
    ring: RingBuffer,
    modes: ModeTracker,
    attached: Option<Attached>,
    next_token: u32,
}

/// A running or exited session. Shared between the manager and the threads
/// of the session.
pub struct Session {
    info: Mutex<SessionInfo>,
    status: Mutex<StatusTracker>,
    /// CPU and memory of the process tree, measured by the status loop.
    usage: Mutex<Option<TreeUsage>>,
    queue: Mutex<PromptQueue>,
    output: Mutex<Output>,
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

/// Everything a new session needs from the spawned PTY.
pub struct Spawned {
    pub master: Box<dyn MasterPty + Send>,
    pub child: Box<dyn Child + Send + Sync>,
    pub reader: Box<dyn Read + Send>,
    pub writer: Box<dyn Write + Send>,
}

impl Session {
    /// Wraps a spawned PTY and starts its reader, pump and waiter threads.
    /// `on_exit` runs once after the process ended and its output is drained.
    pub fn start(
        info: SessionInfo,
        status: StatusConfig,
        spawned: Spawned,
        on_exit: impl FnOnce() + Send + 'static,
    ) -> Result<Arc<Self>> {
        let Spawned {
            master,
            mut child,
            reader,
            writer,
        } = spawned;
        let id = info.id;
        let session = Arc::new(Self {
            info: Mutex::new(info),
            status: Mutex::new(StatusTracker::new(status, Instant::now())),
            usage: Mutex::new(None),
            queue: Mutex::new(PromptQueue::default()),
            output: Mutex::new(Output {
                ring: RingBuffer::new(SCROLLBACK_BYTES),
                modes: ModeTracker::default(),
                attached: None,
                next_token: 1,
            }),
            writer: Mutex::new(Some(writer)),
            master: Mutex::new(Some(master)),
            killer: Mutex::new(child.clone_killer()),
        });

        let (chunks_tx, chunks_rx) = mpsc::channel::<Vec<u8>>();
        let (drained_tx, drained_rx) = mpsc::channel::<()>();
        spawn_thread(format!("pty-{id}-read"), move || {
            read_loop(reader, chunks_tx)
        })?;
        let pump_session = Arc::clone(&session);
        spawn_thread(format!("pty-{id}-pump"), move || {
            pump_loop(&pump_session, &chunks_rx);
            let _ = drained_tx.send(());
        })?;
        let wait_session = Arc::clone(&session);
        spawn_thread(format!("pty-{id}-wait"), move || {
            let status = child.wait();
            // Give the reader a moment to deliver the last output; on Windows
            // the pipe only closes once the pseudo console is closed below.
            let _ = drained_rx.recv_timeout(DRAIN_TIMEOUT);
            wait_session.close_pty();
            let status = match status {
                Ok(status) => SessionStatus::Exited {
                    exit_code: status.exit_code(),
                    signal: status.signal().map(str::to_owned),
                },
                Err(err) => {
                    log::warn!("waiting for session {id} failed: {err}");
                    SessionStatus::Exited {
                        exit_code: 1,
                        signal: None,
                    }
                }
            };
            let success = matches!(
                status,
                SessionStatus::Exited {
                    exit_code: 0,
                    signal: None
                }
            );
            lock(&wait_session.status).on_exit(success);
            lock(&wait_session.info).status = status;
            wait_session.refresh_state(Instant::now());
            on_exit();
        })?;
        Ok(session)
    }

    pub fn info(&self) -> SessionInfo {
        lock(&self.info).clone()
    }

    pub fn pid(&self) -> Option<u32> {
        lock(&self.info).pid
    }

    /// Re-evaluates the agent state; returns whether it changed.
    pub fn refresh_state(&self, now: Instant) -> bool {
        let (state, attention, prompts, intensity) = {
            let mut status = lock(&self.status);
            let state = status.state(now);
            let intensity = status.intensity(now);
            (
                state,
                status.message().map(str::to_owned),
                status.prompts(),
                // Only the rain of a working agent has a density.
                if state == AgentState::Working {
                    intensity
                } else {
                    1
                },
            )
        };
        let mut info = lock(&self.info);
        let changed = info.state != state
            || info.attention != attention
            || info.prompts != prompts
            || info.intensity != intensity;
        info.state = state;
        info.attention = attention;
        info.prompts = prompts;
        info.intensity = intensity;
        changed
    }

    /// Applies a message of an adapter hook; returns whether the state
    /// changed.
    pub fn apply_hook(&self, message: &HookMessage, now: Instant) -> bool {
        {
            let mut status = lock(&self.status);
            match adapters::signal(message, status.adapter_state()) {
                Some(signal) => status.on_adapter(signal),
                None => return false,
            }
        }
        self.refresh_state(now)
    }

    /// Adds a follow-up prompt; it is sent once the agent is idle.
    pub fn queue_prompt(&self, text: &str) -> Result<QueuedPrompt> {
        let mut queue = lock(&self.queue);
        let prompt = queue.push(text).map_err(|rejection| {
            Error::PromptRejected(
                match rejection {
                    QueueRejection::Empty => "the prompt is empty",
                    QueueRejection::TooLong => "the prompt is too long",
                    QueueRejection::Full => "the queue is full",
                }
                .into(),
            )
        })?;
        self.sync_queue(&queue);
        Ok(prompt)
    }

    /// Changes the queue; returns whether anything changed.
    pub fn edit_queue(&self, edit: impl FnOnce(&mut PromptQueue) -> bool) -> bool {
        let mut queue = lock(&self.queue);
        let changed = edit(&mut queue);
        if changed {
            self.sync_queue(&queue);
        }
        changed
    }

    /// Takes the next queued prompt if the agent is ready for it.
    pub fn take_due_prompt(&self, now: Instant) -> Option<QueuedPrompt> {
        let (running, state) = {
            let info = lock(&self.info);
            (info.status == SessionStatus::Running, info.state)
        };
        if !running {
            return None;
        }
        let last_input = lock(&self.status).last_input();
        let mut queue = lock(&self.queue);
        let prompt = queue.take_due(state, last_input, now)?;
        self.sync_queue(&queue);
        Some(prompt)
    }

    /// Types a prompt into the program and submits it. Blocks while the
    /// program does not read its input, so it runs off the status thread.
    pub fn submit(&self, text: &str) -> Result<()> {
        self.paste(text)?;
        std::thread::sleep(SUBMIT_DELAY);
        self.write(b"\r")
    }

    fn sync_queue(&self, queue: &PromptQueue) {
        lock(&self.info).queue = queue.items().to_vec();
    }

    /// The last line of output, see [`StatusTracker::last_line`].
    pub fn last_line(&self) -> String {
        lock(&self.status).last_line()
    }

    pub fn set_cpu_busy(&self, busy: bool) {
        lock(&self.status).set_cpu_busy(busy);
    }

    pub fn set_usage(&self, usage: TreeUsage) {
        *lock(&self.usage) = Some(usage);
    }

    /// The last measured usage; `None` before the first measurement or
    /// after the program exited.
    pub fn usage(&self) -> Option<TreeUsage> {
        if self.is_running() {
            *lock(&self.usage)
        } else {
            None
        }
    }

    pub fn is_running(&self) -> bool {
        lock(&self.info).status == SessionStatus::Running
    }

    /// Whether the program asked for bracketed paste (`CSI ? 2004 h`).
    pub fn bracketed_paste(&self) -> bool {
        lock(&self.output).modes.bracketed_paste()
    }

    /// Connects a terminal view. The buffered output is sent first, then
    /// live output. Replaces a previous view; returns a token for
    /// [`Session::detach`].
    pub fn attach(&self, sink: Box<dyn OutputSink>) -> u32 {
        let mut output = lock(&self.output);
        let mut decoder = Utf8Decoder::default();
        let replay = decoder.decode(&output.ring.snapshot());
        // Sent under the lock, so no live output can overtake the replay.
        if !replay.is_empty() {
            sink.send(replay);
        }
        let token = output.next_token;
        output.next_token = output.next_token.wrapping_add(1);
        output.attached = Some(Attached {
            token,
            sink,
            decoder,
        });
        token
    }

    /// Disconnects the view with this token. A newer view stays attached.
    pub fn detach(&self, token: u32) {
        let mut output = lock(&self.output);
        if output.attached.as_ref().is_some_and(|a| a.token == token) {
            output.attached = None;
        }
    }

    pub fn write(&self, data: &[u8]) -> Result<()> {
        if !is_terminal_reply(data) {
            let mut status = lock(&self.status);
            status.on_input(Instant::now());
            if is_submit(data) {
                status.on_submit();
            }
        }
        let mut writer = lock(&self.writer);
        let writer = writer
            .as_mut()
            .ok_or_else(|| Error::SessionExited(lock(&self.info).id))?;
        writer.write_all(data)?;
        writer.flush()?;
        Ok(())
    }

    /// Sends text as if it was pasted: line breaks become carriage returns,
    /// and the text is wrapped in paste brackets when the program asked for
    /// them, so new lines do not submit a prompt.
    pub fn paste(&self, text: &str) -> Result<()> {
        self.write(paste_data(text, self.bracketed_paste()).as_bytes())
    }

    pub fn resize(&self, cols: u16, rows: u16) -> Result<()> {
        if let Some(master) = lock(&self.master).as_ref() {
            master
                .resize(PtySize {
                    rows: rows.max(1),
                    cols: cols.max(1),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|err| Error::Pty(err.to_string()))?;
        }
        Ok(())
    }

    /// Asks the process to end (SIGHUP on Unix, terminate on Windows).
    pub fn kill(&self) {
        if !self.is_running() {
            return;
        }
        if let Err(err) = lock(&self.killer).kill() {
            log::debug!("could not kill session {}: {err}", lock(&self.info).id);
        }
    }

    /// Feeds output into the buffer and the attached view.
    fn push_output(&self, bytes: &[u8]) {
        lock(&self.status).on_output(bytes, Instant::now());
        let mut output = lock(&self.output);
        output.ring.push(bytes);
        output.modes.feed(bytes);
        if let Some(attached) = output.attached.as_mut() {
            let text = attached.decoder.decode(bytes);
            if !text.is_empty() && !attached.sink.send(text) {
                output.attached = None;
            }
        }
    }

    fn close_pty(&self) {
        lock(&self.writer).take();
        lock(&self.master).take();
    }
}

/// Whether input is only an automatic reply of the terminal (cursor
/// position, device attributes, focus change, color query) rather than
/// something the user typed. Replies must not count as answering a question.
fn is_terminal_reply(data: &[u8]) -> bool {
    let mut rest = data;
    if rest.is_empty() {
        return false;
    }
    while let Some(sequence) = rest.strip_prefix(b"\x1b") {
        match sequence.first() {
            Some(b'[') => {
                let body = &sequence[1..];
                let Some(end) = body.iter().position(|byte| (0x40..=0x7e).contains(byte)) else {
                    return false;
                };
                if !matches!(
                    body[end],
                    b'R' | b'c' | b'n' | b'I' | b'O' | b't' | b'x' | b'y'
                ) {
                    return false;
                }
                rest = &body[end + 1..];
            }
            Some(b']' | b'P') => {
                let body = &sequence[1..];
                let end = body
                    .iter()
                    .position(|&byte| byte == 0x07)
                    .map(|index| index + 1)
                    .or_else(|| {
                        body.windows(2)
                            .position(|pair| pair == b"\x1b\\")
                            .map(|index| index + 2)
                    });
                let Some(end) = end else { return false };
                rest = &body[end..];
            }
            _ => return false,
        }
    }
    rest.is_empty()
}

/// Whether input submits a prompt: Enter typed on its own or at the end of
/// typed text, not a line break inside a paste.
fn is_submit(data: &[u8]) -> bool {
    data.ends_with(b"\r") && !data.starts_with(PASTE_START.as_bytes())
}

const PASTE_START: &str = "\x1b[200~";
const PASTE_END: &str = "\x1b[201~";

fn paste_data(text: &str, bracketed: bool) -> String {
    let text = text.replace("\r\n", "\r").replace('\n', "\r");
    if bracketed {
        // A paste end marker inside the text would end the paste early.
        format!("{PASTE_START}{}{PASTE_END}", text.replace(PASTE_END, ""))
    } else {
        text
    }
}

fn spawn_thread(name: String, run: impl FnOnce() + Send + 'static) -> Result<()> {
    std::thread::Builder::new()
        .name(name)
        .spawn(run)
        .map(|_| ())
        .map_err(Error::from)
}

fn read_loop(mut reader: Box<dyn Read + Send>, chunks: Sender<Vec<u8>>) {
    let mut buffer = vec![0u8; READ_BUFFER];
    loop {
        match reader.read(&mut buffer) {
            // EOF, or EIO on Unix once the process and its children are gone.
            Ok(0) | Err(_) => break,
            Ok(read) => {
                if chunks.send(buffer[..read].to_vec()).is_err() {
                    break;
                }
            }
        }
    }
}

/// Batches output: the first chunk after a quiet period goes out at once
/// (keeps typing responsive), later chunks are collected for [`THROTTLE`].
fn pump_loop(session: &Session, chunks: &Receiver<Vec<u8>>) {
    let mut last_flush = Instant::now()
        .checked_sub(THROTTLE)
        .unwrap_or_else(Instant::now);
    while let Ok(mut batch) = chunks.recv() {
        while batch.len() < MAX_BATCH {
            match chunks.try_recv() {
                Ok(more) => batch.extend_from_slice(&more),
                Err(_) => break,
            }
        }
        let deadline = last_flush + THROTTLE;
        let mut disconnected = false;
        while batch.len() < MAX_BATCH {
            let now = Instant::now();
            if now >= deadline {
                break;
            }
            match chunks.recv_timeout(deadline - now) {
                Ok(more) => batch.extend_from_slice(&more),
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    disconnected = true;
                    break;
                }
            }
        }
        session.push_output(&batch);
        last_flush = Instant::now();
        if disconnected {
            break;
        }
    }
}

pub(super) fn lock<T: ?Sized>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    // A poisoned lock only means a thread panicked while holding it; the
    // session state stays usable.
    mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn terminal_replies_are_not_user_input() {
        assert!(is_terminal_reply(b"\x1b[12;40R"));
        assert!(is_terminal_reply(b"\x1b[?1;2c\x1b[I"));
        assert!(is_terminal_reply(b"\x1b]11;rgb:0e0e/1616/2121\x1b\\"));
        assert!(!is_terminal_reply(b"y"));
        assert!(!is_terminal_reply(b"\r"));
        assert!(!is_terminal_reply(b"\x1b[A"));
        assert!(!is_terminal_reply(b"\x1bOB"));
        assert!(!is_terminal_reply(b"\x1b"));
        assert!(!is_terminal_reply(b"\x1b[Ix"));
        assert!(!is_terminal_reply(b""));
    }

    #[test]
    fn enter_submits_but_a_paste_does_not() {
        assert!(is_submit(b"\r"));
        assert!(is_submit(b"ls\r"));
        assert!(!is_submit(b"l"));
        assert!(!is_submit(b"\x1b[200~a\rb\r\x1b[201~"));
    }

    #[test]
    fn paste_data_uses_carriage_returns() {
        assert_eq!(paste_data("a\nb\r\nc", false), "a\rb\rc");
    }

    #[test]
    fn paste_data_adds_brackets_when_asked_for() {
        assert_eq!(paste_data("x\ny", true), "\x1b[200~x\ry\x1b[201~");
        assert_eq!(
            paste_data("evil\x1b[201~rest", true),
            "\x1b[200~evilrest\x1b[201~"
        );
    }
}
