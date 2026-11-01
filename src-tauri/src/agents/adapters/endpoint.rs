//! The local endpoint that hook helpers report to.
//!
//! A TCP listener on the loopback interface only, on a random port. Every
//! message carries a random token that only the sessions of this app know
//! (it is passed in their environment), so other local programs cannot fake
//! a state. One connection carries one JSON line (see [`HookMessage`]).

use std::io::{self, BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::{HOOK_ADDR_ENV, HOOK_TOKEN_ENV};
use crate::pty::SessionId;

/// Version of the line protocol; messages of other versions are ignored.
pub const PROTOCOL: u32 = 1;
/// Longest accepted message line in bytes.
const MAX_MESSAGE: u64 = 16 * 1024;
/// A client that does not finish its line in time is dropped.
const READ_TIMEOUT: Duration = Duration::from_secs(1);
/// The helper gives up after this long, so a hook never stalls the agent.
const CLIENT_TIMEOUT: Duration = Duration::from_secs(1);

/// One report of a hook helper.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HookMessage {
    pub v: u32,
    pub token: String,
    pub session: SessionId,
    /// Which adapter sent it, e.g. `claude`.
    pub agent: String,
    /// The agent's event name, e.g. `Stop`.
    pub event: String,
    /// A detail of the event, e.g. the notification type or the start source.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    /// Text for the user, e.g. the notification message.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// The running endpoint: its address and the token clients must send.
#[derive(Debug, Clone)]
pub struct HookEndpoint {
    addr: SocketAddr,
    token: String,
}

impl HookEndpoint {
    /// Listens on a random loopback port. Valid messages are passed to
    /// `on_message` on the endpoint thread, which lives as long as the app.
    pub fn start(on_message: impl Fn(HookMessage) + Send + 'static) -> io::Result<Self> {
        let token = random_token()?;
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0))?;
        let addr = listener.local_addr()?;
        let expected = token.clone();
        std::thread::Builder::new()
            .name("hook-endpoint".into())
            .spawn(move || {
                for stream in listener.incoming() {
                    match stream {
                        Ok(stream) => match read_message(stream, &expected) {
                            Ok(Some(message)) => on_message(message),
                            Ok(None) => {}
                            Err(err) => log::debug!("hook message dropped: {err}"),
                        },
                        Err(err) => log::debug!("hook connection failed: {err}"),
                    }
                }
            })?;
        Ok(Self { addr, token })
    }

    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    pub fn token(&self) -> &str {
        &self.token
    }

    /// The variables a session needs to reach the endpoint.
    pub fn env(&self) -> Vec<(String, String)> {
        vec![
            (HOOK_ADDR_ENV.to_owned(), self.addr.to_string()),
            (HOOK_TOKEN_ENV.to_owned(), self.token.clone()),
        ]
    }
}

/// Reads one line, returns the message if it is valid and carries the token.
fn read_message(stream: TcpStream, token: &str) -> io::Result<Option<HookMessage>> {
    stream.set_read_timeout(Some(READ_TIMEOUT))?;
    let mut line = Vec::new();
    BufReader::new(stream.take(MAX_MESSAGE)).read_until(b'\n', &mut line)?;
    let Ok(message) = serde_json::from_slice::<HookMessage>(&line) else {
        return Ok(None);
    };
    if message.v != PROTOCOL || !same_secret(message.token.as_bytes(), token.as_bytes()) {
        return Ok(None);
    }
    Ok(Some(message))
}

/// Sends one message to the endpoint at `addr` (client side).
pub fn send(addr: &str, message: &HookMessage) -> io::Result<()> {
    let addr: SocketAddr = addr
        .parse()
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "invalid endpoint address"))?;
    if !addr.ip().is_loopback() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "the endpoint must be on the loopback interface",
        ));
    }
    let mut line = serde_json::to_vec(message)?;
    line.push(b'\n');
    let mut stream = TcpStream::connect_timeout(&addr, CLIENT_TIMEOUT)?;
    stream.set_write_timeout(Some(CLIENT_TIMEOUT))?;
    stream.write_all(&line)?;
    stream.flush()
}

/// Compares two secrets in constant time (for equal lengths).
fn same_secret(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |diff, (x, y)| diff | (x ^ y)) == 0
}

/// 128 random bits from the OS as hex.
fn random_token() -> io::Result<String> {
    let mut bytes = [0u8; 16];
    getrandom::fill(&mut bytes).map_err(|err| io::Error::other(err.to_string()))?;
    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;
    use std::sync::mpsc;

    use super::*;

    fn message(token: &str) -> HookMessage {
        HookMessage {
            v: PROTOCOL,
            token: token.to_owned(),
            session: 7,
            agent: "claude".into(),
            event: "Stop".into(),
            detail: None,
            message: Some("done".into()),
        }
    }

    fn endpoint() -> (HookEndpoint, mpsc::Receiver<HookMessage>) {
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let endpoint = HookEndpoint::start(move |message| {
            let _ = tx.lock().unwrap().send(message);
        })
        .unwrap();
        (endpoint, rx)
    }

    #[test]
    fn delivers_messages_with_the_right_token_only() {
        let (endpoint, received) = endpoint();
        let addr = endpoint.addr().to_string();
        assert!(endpoint.addr().ip().is_loopback());
        assert_eq!(endpoint.token().len(), 32);

        send(&addr, &message("wrong")).unwrap();
        let mut old = message(endpoint.token());
        old.v = PROTOCOL + 1;
        send(&addr, &old).unwrap();
        // Garbage is ignored as well.
        TcpStream::connect(endpoint.addr())
            .unwrap()
            .write_all(b"not json\n")
            .unwrap();
        let valid = message(endpoint.token());
        send(&addr, &valid).unwrap();

        let got = received.recv_timeout(Duration::from_secs(5)).unwrap();
        assert_eq!(got, valid);
        assert!(received.recv_timeout(Duration::from_millis(200)).is_err());
    }

    #[test]
    fn env_names_the_address_and_token() {
        let (endpoint, _received) = endpoint();
        let env = endpoint.env();
        assert_eq!(env[0], (HOOK_ADDR_ENV.into(), endpoint.addr().to_string()));
        assert_eq!(env[1], (HOOK_TOKEN_ENV.into(), endpoint.token().to_owned()));
    }

    #[test]
    fn clients_only_talk_to_loopback_addresses() {
        assert!(send("192.0.2.1:9", &message("x")).is_err());
        assert!(send("nonsense", &message("x")).is_err());
    }

    #[test]
    fn secrets_compare_by_content_and_length() {
        assert!(same_secret(b"abc", b"abc"));
        assert!(!same_secret(b"abc", b"abd"));
        assert!(!same_secret(b"abc", b"abcd"));
    }
}
