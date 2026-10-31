//! Tracks terminal modes that matter when the app writes to a session.

/// Watches the output of a session for DEC private mode changes
/// (`CSI ? Pm h` / `CSI ? Pm l`). Only bracketed paste (2004) is kept: text
/// sent to an agent is wrapped in paste brackets when the agent asked for
/// them, so new lines do not submit the prompt.
#[derive(Debug, Default)]
pub struct ModeTracker {
    state: State,
    params: Vec<u8>,
    bracketed_paste: bool,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
enum State {
    #[default]
    Ground,
    Escape,
    CsiStart,
    CsiPrivate,
    CsiOther,
}

const ESC: u8 = 0x1b;
/// Longer parameter lists are not mode changes we care about.
const MAX_PARAMS: usize = 64;

fn is_final(byte: u8) -> bool {
    (0x40..=0x7e).contains(&byte)
}

impl ModeTracker {
    pub fn bracketed_paste(&self) -> bool {
        self.bracketed_paste
    }

    pub fn feed(&mut self, bytes: &[u8]) {
        for &byte in bytes {
            self.state = match (self.state, byte) {
                (_, ESC) => State::Escape,
                (State::Ground, _) => State::Ground,
                (State::Escape, b'[') => State::CsiStart,
                (State::Escape, _) => State::Ground,
                (State::CsiStart, b'?') => {
                    self.params.clear();
                    State::CsiPrivate
                }
                (State::CsiStart | State::CsiOther, _) if is_final(byte) => State::Ground,
                (State::CsiStart | State::CsiOther, _) => State::CsiOther,
                (State::CsiPrivate, b'0'..=b'9' | b';') => {
                    if self.params.len() < MAX_PARAMS {
                        self.params.push(byte);
                    }
                    State::CsiPrivate
                }
                (State::CsiPrivate, b'h' | b'l') => {
                    if self.params.split(|&c| c == b';').any(|p| p == b"2004") {
                        self.bracketed_paste = byte == b'h';
                    }
                    State::Ground
                }
                (State::CsiPrivate, _) if is_final(byte) => State::Ground,
                (State::CsiPrivate, _) => State::CsiOther,
            };
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_bracketed_paste() {
        let mut modes = ModeTracker::default();
        assert!(!modes.bracketed_paste());
        modes.feed(b"prompt \x1b[?2004h> ");
        assert!(modes.bracketed_paste());
        modes.feed(b"\x1b[?2004l");
        assert!(!modes.bracketed_paste());
    }

    #[test]
    fn handles_sequences_split_across_chunks() {
        let mut modes = ModeTracker::default();
        for byte in b"\x1b[?2004h" {
            modes.feed(&[*byte]);
        }
        assert!(modes.bracketed_paste());
    }

    #[test]
    fn handles_combined_parameters() {
        let mut modes = ModeTracker::default();
        modes.feed(b"\x1b[?1049;2004h");
        assert!(modes.bracketed_paste());
        modes.feed(b"\x1b[?25l\x1b[?1049l");
        assert!(modes.bracketed_paste());
    }

    #[test]
    fn ignores_other_sequences() {
        let mut modes = ModeTracker::default();
        modes.feed(b"\x1b[2004h\x1b[31m\x1b]0;title\x07 2004h");
        assert!(!modes.bracketed_paste());
    }
}
