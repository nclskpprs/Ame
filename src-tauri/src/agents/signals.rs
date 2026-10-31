//! Reads terminal output for status signals: bells, OSC 9 / OSC 777
//! notifications and the plain text without escape sequences.

/// What one chunk of output contained.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct Signals {
    /// A bell outside of an escape sequence.
    pub bell: bool,
    /// The message of the last OSC 9 or OSC 777 notification.
    pub notification: Option<String>,
}

/// Longest OSC sequence that is kept; longer ones are skipped.
const MAX_OSC: usize = 4096;

const ESC: u8 = 0x1b;
const BEL: u8 = 0x07;

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
enum State {
    #[default]
    Ground,
    Escape,
    Csi,
    Osc,
    /// ESC inside an OSC: `ESC \` ends it (string terminator).
    OscEscape,
}

/// Splits output into plain text and signals. Keeps its state between
/// chunks, so sequences split across reads are handled.
#[derive(Debug, Default)]
pub struct SignalParser {
    state: State,
    osc: Vec<u8>,
}

impl SignalParser {
    /// Parses a chunk; printable text (and line breaks) is appended to `text`.
    pub fn feed(&mut self, bytes: &[u8], text: &mut Vec<u8>) -> Signals {
        let mut signals = Signals::default();
        for &byte in bytes {
            self.state = match (self.state, byte) {
                (State::Ground, ESC) => State::Escape,
                (State::Ground, BEL) => {
                    signals.bell = true;
                    State::Ground
                }
                (State::Ground, b'\n') => {
                    text.push(b'\n');
                    State::Ground
                }
                (State::Ground, b'\r' | b'\t') => {
                    text.push(b' ');
                    State::Ground
                }
                (State::Ground, _) if byte < 0x20 || byte == 0x7f => State::Ground,
                (State::Ground, _) => {
                    text.push(byte);
                    State::Ground
                }
                (State::Escape, b'[') => State::Csi,
                (State::Escape, b']') => {
                    self.osc.clear();
                    State::Osc
                }
                (State::Escape, ESC) => State::Escape,
                (State::Escape, _) => State::Ground,
                (State::Csi, ESC) => State::Escape,
                (State::Csi, 0x40..=0x7e) => State::Ground,
                (State::Csi, _) => State::Csi,
                (State::Osc, BEL) => {
                    self.finish_osc(&mut signals);
                    State::Ground
                }
                (State::Osc, ESC) => State::OscEscape,
                (State::Osc, _) => {
                    if self.osc.len() < MAX_OSC {
                        self.osc.push(byte);
                    }
                    State::Osc
                }
                (State::OscEscape, b'\\') => {
                    self.finish_osc(&mut signals);
                    State::Ground
                }
                (State::OscEscape, b'[') => State::Csi,
                (State::OscEscape, _) => State::Ground,
            };
        }
        signals
    }

    fn finish_osc(&mut self, signals: &mut Signals) {
        let osc = String::from_utf8_lossy(&self.osc);
        if let Some(message) = notification(&osc) {
            signals.notification = Some(message);
        }
        self.osc.clear();
    }
}

/// The message of an OSC 9 (`9;message`) or OSC 777
/// (`777;notify;title;body`) notification. OSC 9 with a number is a
/// progress report (ConEmu / Windows Terminal), not a notification.
fn notification(osc: &str) -> Option<String> {
    if let Some(message) = osc.strip_prefix("9;") {
        let first = message.split(';').next().unwrap_or_default();
        if first.chars().all(|c| c.is_ascii_digit()) {
            return None;
        }
        return Some(message.trim().to_owned());
    }
    let mut parts = osc.strip_prefix("777;notify;")?.splitn(2, ';');
    let title = parts.next().unwrap_or_default().trim();
    let body = parts.next().unwrap_or_default().trim();
    Some(match (title.is_empty(), body.is_empty()) {
        (_, true) => title.to_owned(),
        (true, false) => body.to_owned(),
        (false, false) => format!("{title}: {body}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(chunks: &[&[u8]]) -> (Signals, String) {
        let mut parser = SignalParser::default();
        let mut text = Vec::new();
        let mut all = Signals::default();
        for chunk in chunks {
            let signals = parser.feed(chunk, &mut text);
            all.bell |= signals.bell;
            if signals.notification.is_some() {
                all.notification = signals.notification;
            }
        }
        (all, String::from_utf8(text).unwrap())
    }

    #[test]
    fn strips_escape_sequences() {
        let (signals, text) =
            parse(&[b"\x1b[1;32mDo you want\x1b[0m to\r\nproceed?\x1b]0;title\x07"]);
        assert_eq!(text, "Do you want to \nproceed?");
        assert_eq!(signals, Signals::default());
    }

    #[test]
    fn detects_bells_but_not_osc_terminators() {
        assert!(parse(&[b"done\x07"]).0.bell);
        assert!(!parse(&[b"\x1b]2;title\x07"]).0.bell);
    }

    #[test]
    fn reads_osc_9_and_777_notifications() {
        let (signals, _) = parse(&[b"\x1b]9;Claude needs your permission\x07"]);
        assert_eq!(
            signals.notification.as_deref(),
            Some("Claude needs your permission")
        );
        let (signals, _) = parse(&[b"\x1b]777;notify;Codex;Approval needed\x1b\\"]);
        assert_eq!(
            signals.notification.as_deref(),
            Some("Codex: Approval needed")
        );
        // Progress reports are not notifications.
        assert_eq!(parse(&[b"\x1b]9;4;1;50\x07"]).0.notification, None);
    }

    #[test]
    fn handles_sequences_split_across_chunks() {
        let (signals, text) = parse(&[b"a\x1b", b"[31mb\x1b]9;hi", b"\x07c"]);
        assert_eq!(text, "abc");
        assert_eq!(signals.notification.as_deref(), Some("hi"));
        assert!(!signals.bell);
    }
}
