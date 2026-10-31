//! Generic agent status detection from terminal output, input and exit.
//!
//! See *Agent status detection* in `docs/ARCHITECTURE.md`. Works for any
//! program; agent profiles only add text patterns and the idle delay.

use std::time::{Duration, Instant};

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;

use super::signals::SignalParser;

/// What an agent is doing, as shown in the sidebar, tabs and dashboard.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub enum AgentState {
    /// Started, nothing printed yet.
    Starting,
    /// Printing output or busy (CPU).
    Working,
    /// Asked a question or sent a notification; waits for the user.
    NeedsInput,
    /// Quiet: done, or waiting for the next prompt.
    Idle,
    /// The process ended successfully.
    Exited,
    /// The process ended with an error code or a signal.
    Error,
}

/// Default delay without output after which an agent counts as idle.
pub const DEFAULT_IDLE_AFTER: Duration = Duration::from_millis(3000);
/// Output this soon after input is mostly the echo of what was typed.
const ECHO_WINDOW: Duration = Duration::from_millis(250);
/// Patterns and notifications count once the output paused this long.
const SETTLE: Duration = Duration::from_millis(400);
/// A session that printed nothing for this long is idle, not starting.
const STARTING_GRACE: Duration = Duration::from_secs(5);
/// Plain text kept for pattern matching.
const TAIL_BYTES: usize = 4096;
/// Plain text kept for the last line shown in the dashboard.
const RECENT_BYTES: usize = 2048;
/// Longest last line returned, in characters.
const MAX_LINE_CHARS: usize = 200;

/// Text that most command-line programs print when they ask a yes/no question.
const GENERIC_PATTERNS: &[&str] = &[r"\(y/n\)", r"\[y/N\]", r"\[Y/n\]", r"\(yes/no\)"];

/// Per-profile settings for the status detection.
#[derive(Debug, Clone)]
pub struct StatusConfig {
    pub idle_after: Duration,
    pub patterns: Vec<Regex>,
}

impl StatusConfig {
    /// Compiles the profile patterns plus the generic ones; invalid patterns
    /// are skipped with a warning.
    pub fn new(idle_after_ms: Option<u32>, patterns: &[String]) -> Self {
        let patterns = patterns
            .iter()
            .map(String::as_str)
            .chain(GENERIC_PATTERNS.iter().copied())
            .filter_map(|pattern| match Regex::new(pattern) {
                Ok(regex) => Some(regex),
                Err(err) => {
                    log::warn!("invalid status pattern {pattern:?}: {err}");
                    None
                }
            })
            .collect();
        Self {
            idle_after: idle_after_ms.map_or(DEFAULT_IDLE_AFTER, |ms| {
                Duration::from_millis(u64::from(ms.max(500)))
            }),
            patterns,
        }
    }
}

impl Default for StatusConfig {
    fn default() -> Self {
        Self::new(None, &[])
    }
}

/// Derives an [`AgentState`] from what a session prints and receives.
#[derive(Debug)]
pub struct StatusTracker {
    config: StatusConfig,
    parser: SignalParser,
    started: Instant,
    last_output: Option<Instant>,
    last_input: Option<Instant>,
    /// Plain text printed since the last input, for the patterns.
    tail: Vec<u8>,
    /// The most recent plain text, kept across input.
    recent: Vec<u8>,
    tail_checked: bool,
    /// A bell, notification or matching pattern since the last input.
    attention: bool,
    message: Option<String>,
    cpu_busy: bool,
    exit: Option<bool>,
}

impl StatusTracker {
    pub fn new(config: StatusConfig, now: Instant) -> Self {
        Self {
            config,
            parser: SignalParser::default(),
            started: now,
            last_output: None,
            last_input: None,
            tail: Vec::new(),
            recent: Vec::new(),
            tail_checked: true,
            attention: false,
            message: None,
            cpu_busy: false,
            exit: None,
        }
    }

    pub fn on_output(&mut self, bytes: &[u8], now: Instant) {
        let mut text = Vec::new();
        let signals = self.parser.feed(bytes, &mut text);
        if signals.bell || signals.notification.is_some() {
            self.attention = true;
        }
        if signals.notification.is_some() {
            self.message = signals.notification;
        }
        let echo = self
            .last_input
            .is_some_and(|input| now.saturating_duration_since(input) < ECHO_WINDOW);
        if !echo {
            self.last_output = Some(now);
        }
        if !text.is_empty() {
            append_bounded(&mut self.tail, &text, TAIL_BYTES);
            append_bounded(&mut self.recent, &text, RECENT_BYTES);
            self.tail_checked = false;
        }
    }

    /// The user typed or pasted something: questions count as answered.
    pub fn on_input(&mut self, now: Instant) {
        self.last_input = Some(now);
        self.attention = false;
        self.message = None;
        self.tail.clear();
        self.tail_checked = true;
    }

    pub fn on_exit(&mut self, success: bool) {
        self.exit = Some(success);
    }

    /// Whether the process tree uses noticeable CPU (e.g. a build the agent runs).
    pub fn set_cpu_busy(&mut self, busy: bool) {
        self.cpu_busy = busy;
    }

    /// The last non-empty line of plain output, shortened, e.g. for the
    /// dashboard. Full-screen programs redraw in place, so this is a hint.
    pub fn last_line(&self) -> String {
        let text = String::from_utf8_lossy(&self.recent);
        let line = text
            .lines()
            .rev()
            .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
            .find(|line| !line.is_empty())
            .unwrap_or_default();
        line.chars().take(MAX_LINE_CHARS).collect()
    }

    /// The text of the last terminal notification, if it was not answered yet.
    pub fn message(&self) -> Option<&str> {
        self.message.as_deref()
    }

    pub fn state(&mut self, now: Instant) -> AgentState {
        if let Some(success) = self.exit {
            return if success {
                AgentState::Exited
            } else {
                AgentState::Error
            };
        }
        let quiet = self
            .last_output
            .map_or(now.saturating_duration_since(self.started), |output| {
                now.saturating_duration_since(output)
            });
        if quiet >= SETTLE && !self.tail_checked {
            self.tail_checked = true;
            let text = String::from_utf8_lossy(&self.tail);
            if self
                .config
                .patterns
                .iter()
                .any(|regex| regex.is_match(&text))
            {
                self.attention = true;
            }
        }
        if self.last_output.is_some() && quiet < SETTLE {
            AgentState::Working
        } else if self.attention {
            AgentState::NeedsInput
        } else if self.cpu_busy || (self.last_output.is_some() && quiet < self.config.idle_after) {
            AgentState::Working
        } else if self.last_output.is_none()
            && now.saturating_duration_since(self.started) < STARTING_GRACE
        {
            AgentState::Starting
        } else {
            AgentState::Idle
        }
    }
}

fn append_bounded(buffer: &mut Vec<u8>, text: &[u8], limit: usize) {
    buffer.extend_from_slice(text);
    let excess = buffer.len().saturating_sub(limit);
    buffer.drain(..excess);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ms(value: u64) -> Duration {
        Duration::from_millis(value)
    }

    fn tracker(patterns: &[&str]) -> (StatusTracker, Instant) {
        let now = Instant::now();
        let patterns: Vec<String> = patterns.iter().map(|p| (*p).to_owned()).collect();
        (
            StatusTracker::new(StatusConfig::new(Some(1000), &patterns), now),
            now,
        )
    }

    #[test]
    fn starts_then_works_then_idles() {
        let (mut status, t0) = tracker(&[]);
        assert_eq!(status.state(t0 + ms(100)), AgentState::Starting);
        status.on_output(b"thinking...", t0 + ms(200));
        assert_eq!(status.state(t0 + ms(300)), AgentState::Working);
        assert_eq!(status.state(t0 + ms(900)), AgentState::Working);
        assert_eq!(status.state(t0 + ms(1300)), AgentState::Idle);
    }

    #[test]
    fn a_silent_program_becomes_idle() {
        let (mut status, t0) = tracker(&[]);
        assert_eq!(status.state(t0 + STARTING_GRACE), AgentState::Idle);
    }

    #[test]
    fn echo_of_typed_input_is_not_activity() {
        let (mut status, t0) = tracker(&[]);
        status.on_output(b"$ ", t0);
        let idle = t0 + ms(2000);
        assert_eq!(status.state(idle), AgentState::Idle);
        status.on_input(idle);
        status.on_output(b"l", idle + ms(20));
        assert_eq!(status.state(idle + ms(100)), AgentState::Idle);
        // Output that continues after the echo window is real work.
        status.on_output(b"output", idle + ms(400));
        assert_eq!(status.state(idle + ms(450)), AgentState::Working);
    }

    #[test]
    fn notifications_ask_for_input_until_answered() {
        let (mut status, t0) = tracker(&[]);
        status.on_output(b"\x1b]9;Permission needed\x07", t0);
        // While output is still flowing it counts as work.
        assert_eq!(status.state(t0 + ms(100)), AgentState::Working);
        assert_eq!(status.state(t0 + ms(500)), AgentState::NeedsInput);
        assert_eq!(status.message(), Some("Permission needed"));
        assert_eq!(status.state(t0 + ms(5000)), AgentState::NeedsInput);
        status.on_input(t0 + ms(6000));
        assert_eq!(status.message(), None);
        assert_eq!(status.state(t0 + ms(9000)), AgentState::Idle);
    }

    #[test]
    fn bells_ask_for_input() {
        let (mut status, t0) = tracker(&[]);
        status.on_output(b"done\x07", t0);
        assert_eq!(status.state(t0 + ms(500)), AgentState::NeedsInput);
    }

    #[test]
    fn patterns_match_text_printed_since_the_last_input() {
        let (mut status, t0) = tracker(&["Do you want to"]);
        status.on_output(b"\x1b[1mDo you want to\x1b[0m proceed?", t0);
        assert_eq!(status.state(t0 + ms(500)), AgentState::NeedsInput);
        status.on_input(t0 + ms(600));
        // The old question is still on screen but was answered.
        status.on_output(b"Running tests", t0 + ms(1000));
        assert_eq!(status.state(t0 + ms(1500)), AgentState::Working);
        assert_eq!(status.state(t0 + ms(3000)), AgentState::Idle);
    }

    #[test]
    fn generic_yes_no_questions_are_detected() {
        let (mut status, t0) = tracker(&[]);
        status.on_output(b"Overwrite file? [y/N] ", t0);
        assert_eq!(status.state(t0 + ms(500)), AgentState::NeedsInput);
    }

    #[test]
    fn cpu_use_counts_as_work() {
        let (mut status, t0) = tracker(&[]);
        status.on_output(b"$ cargo build", t0);
        status.set_cpu_busy(true);
        assert_eq!(status.state(t0 + ms(10_000)), AgentState::Working);
        status.set_cpu_busy(false);
        assert_eq!(status.state(t0 + ms(10_000)), AgentState::Idle);
    }

    #[test]
    fn exit_wins() {
        let (mut status, t0) = tracker(&[]);
        status.on_exit(true);
        assert_eq!(status.state(t0), AgentState::Exited);
        status.on_exit(false);
        assert_eq!(status.state(t0), AgentState::Error);
    }

    #[test]
    fn last_line_skips_empty_lines_and_survives_input() {
        let (mut status, t0) = tracker(&[]);
        status.on_output(b"first\r\n\x1b[32m  second   line \x1b[0m\r\n\r\n", t0);
        assert_eq!(status.last_line(), "second line");
        status.on_input(t0 + ms(10));
        assert_eq!(status.last_line(), "second line");
    }

    #[test]
    fn invalid_patterns_are_skipped() {
        let config = StatusConfig::new(Some(10), &["(".to_owned(), "ok".to_owned()]);
        assert_eq!(config.patterns.len(), GENERIC_PATTERNS.len() + 1);
        assert_eq!(config.idle_after, ms(500));
    }
}
