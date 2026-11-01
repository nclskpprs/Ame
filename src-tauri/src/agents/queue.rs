//! Follow-up prompts queued per session, sent one at a time whenever the
//! agent is idle.
//!
//! The queue lives in the backend, so it keeps working while the window is
//! hidden (ADR 0021). The decision when to send is pure and tested here; the
//! status loop of the PTY manager asks for it on every tick.

use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use specta::Type;

use super::status::AgentState;

/// Longest prompt accepted, in bytes.
pub const MAX_PROMPT_BYTES: usize = 64 * 1024;
/// Most prompts waiting per session.
pub const MAX_QUEUED: usize = 50;
/// The user typed this recently: they may be writing a prompt by hand, so
/// nothing is sent into their input line.
const TYPING_PAUSE: Duration = Duration::from_secs(4);
/// After a prompt was sent, the next one waits until the agent was seen
/// working. An agent that stays quiet this long probably took the prompt
/// without printing, so the queue goes on.
const SENT_TIMEOUT: Duration = Duration::from_secs(30);

/// A prompt waiting for its turn.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct QueuedPrompt {
    /// Unique within its session.
    pub id: u32,
    pub text: String,
}

/// Why a prompt was not queued.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QueueRejection {
    Empty,
    TooLong,
    Full,
}

#[derive(Debug, Default)]
pub struct PromptQueue {
    items: Vec<QueuedPrompt>,
    next_id: u32,
    /// When the last prompt was sent, until the agent was seen working.
    sent_at: Option<Instant>,
}

impl PromptQueue {
    pub fn items(&self) -> &[QueuedPrompt] {
        &self.items
    }

    pub fn push(&mut self, text: &str) -> Result<QueuedPrompt, QueueRejection> {
        let text = text.trim();
        if text.is_empty() {
            return Err(QueueRejection::Empty);
        }
        if text.len() > MAX_PROMPT_BYTES {
            return Err(QueueRejection::TooLong);
        }
        if self.items.len() >= MAX_QUEUED {
            return Err(QueueRejection::Full);
        }
        self.next_id = self.next_id.wrapping_add(1);
        let prompt = QueuedPrompt {
            id: self.next_id,
            text: text.to_owned(),
        };
        self.items.push(prompt.clone());
        Ok(prompt)
    }

    /// Removes one prompt; returns whether it was still waiting.
    pub fn remove(&mut self, id: u32) -> bool {
        let before = self.items.len();
        self.items.retain(|prompt| prompt.id != id);
        self.items.len() != before
    }

    /// Moves a prompt one place up (`-1`) or down (`1`); returns whether it
    /// moved.
    pub fn shift(&mut self, id: u32, by: i32) -> bool {
        let Some(from) = self.items.iter().position(|prompt| prompt.id == id) else {
            return false;
        };
        let to = if by < 0 {
            from.checked_sub(1)
        } else {
            Some(from + 1).filter(|to| *to < self.items.len())
        };
        let Some(to) = to else { return false };
        self.items.swap(from, to);
        true
    }

    pub fn clear(&mut self) -> bool {
        let had = !self.items.is_empty();
        self.items.clear();
        had
    }

    /// Takes the next prompt if it is due: the agent is idle (not asking a
    /// question, not working), the user did not type a moment ago, and the
    /// previous prompt was picked up.
    pub fn take_due(
        &mut self,
        state: AgentState,
        last_input: Option<Instant>,
        now: Instant,
    ) -> Option<QueuedPrompt> {
        if let Some(sent) = self.sent_at {
            let picked_up = !matches!(state, AgentState::Idle);
            if picked_up || now.saturating_duration_since(sent) >= SENT_TIMEOUT {
                self.sent_at = None;
            }
        }
        if self.items.is_empty() || self.sent_at.is_some() || state != AgentState::Idle {
            return None;
        }
        if last_input.is_some_and(|input| now.saturating_duration_since(input) < TYPING_PAUSE) {
            return None;
        }
        self.sent_at = Some(now);
        Some(self.items.remove(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn secs(value: u64) -> Duration {
        Duration::from_secs(value)
    }

    fn queue(texts: &[&str]) -> PromptQueue {
        let mut queue = PromptQueue::default();
        for text in texts {
            queue.push(text).unwrap();
        }
        queue
    }

    fn texts(queue: &PromptQueue) -> Vec<&str> {
        queue.items().iter().map(|p| p.text.as_str()).collect()
    }

    #[test]
    fn rejects_empty_long_and_too_many_prompts() {
        let mut queue = PromptQueue::default();
        assert_eq!(queue.push("  \n"), Err(QueueRejection::Empty));
        let long = "x".repeat(MAX_PROMPT_BYTES + 1);
        assert_eq!(queue.push(&long), Err(QueueRejection::TooLong));
        for _ in 0..MAX_QUEUED {
            queue.push("a").unwrap();
        }
        assert_eq!(queue.push("b"), Err(QueueRejection::Full));
    }

    #[test]
    fn trims_and_numbers_prompts() {
        let mut queue = PromptQueue::default();
        let first = queue.push("  fix the tests\n").unwrap();
        let second = queue.push("then lint").unwrap();
        assert_eq!(first.text, "fix the tests");
        assert_ne!(first.id, second.id);
    }

    #[test]
    fn removes_moves_and_clears() {
        let mut queue = queue(&["a", "b", "c"]);
        let ids: Vec<_> = queue.items().iter().map(|p| p.id).collect();
        assert!(queue.shift(ids[2], -1));
        assert_eq!(texts(&queue), ["a", "c", "b"]);
        assert!(!queue.shift(ids[0], -1), "first cannot move up");
        assert!(!queue.shift(ids[1], 1), "last cannot move down");
        assert!(queue.remove(ids[0]));
        assert!(!queue.remove(ids[0]));
        assert_eq!(texts(&queue), ["c", "b"]);
        assert!(queue.clear());
        assert!(!queue.clear());
    }

    #[test]
    fn sends_only_when_idle() {
        let t0 = Instant::now();
        let mut queue = queue(&["a"]);
        for state in [
            AgentState::Starting,
            AgentState::Working,
            AgentState::NeedsInput,
            AgentState::Exited,
            AgentState::Error,
        ] {
            assert_eq!(queue.take_due(state, None, t0), None, "{state:?}");
        }
        let sent = queue.take_due(AgentState::Idle, None, t0).unwrap();
        assert_eq!(sent.text, "a");
        assert!(queue.items().is_empty());
    }

    #[test]
    fn waits_while_the_user_types() {
        let t0 = Instant::now();
        let mut queue = queue(&["a"]);
        assert_eq!(
            queue.take_due(AgentState::Idle, Some(t0), t0 + secs(1)),
            None
        );
        assert!(
            queue
                .take_due(AgentState::Idle, Some(t0), t0 + TYPING_PAUSE)
                .is_some()
        );
    }

    #[test]
    fn waits_until_the_agent_picked_up_the_last_prompt() {
        let t0 = Instant::now();
        let mut queue = queue(&["a", "b"]);
        assert!(queue.take_due(AgentState::Idle, None, t0).is_some());
        // Still idle right after sending: the agent did not react yet.
        assert_eq!(
            queue.take_due(AgentState::Idle, Some(t0), t0 + secs(5)),
            None
        );
        assert_eq!(
            queue.take_due(AgentState::Working, Some(t0), t0 + secs(6)),
            None
        );
        let next = queue.take_due(AgentState::Idle, Some(t0), t0 + secs(20));
        assert_eq!(next.map(|p| p.text), Some("b".into()));
    }

    #[test]
    fn goes_on_when_the_agent_never_reacts() {
        let t0 = Instant::now();
        let mut queue = queue(&["a", "b"]);
        assert!(queue.take_due(AgentState::Idle, None, t0).is_some());
        assert_eq!(queue.take_due(AgentState::Idle, None, t0 + secs(29)), None);
        assert!(
            queue
                .take_due(AgentState::Idle, None, t0 + SENT_TIMEOUT)
                .is_some()
        );
    }
}
