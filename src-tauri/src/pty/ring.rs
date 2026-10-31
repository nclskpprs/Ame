//! Byte ring buffer with the most recent output of a session.

use std::collections::VecDeque;

/// Keeps the last `capacity` bytes of terminal output. Hidden sessions have
/// no terminal view; their output is replayed from here when one is opened.
#[derive(Debug)]
pub struct RingBuffer {
    data: VecDeque<u8>,
    capacity: usize,
    /// Older output was dropped, so the buffer may start mid-line.
    truncated: bool,
}

impl RingBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            data: VecDeque::new(),
            capacity,
            truncated: false,
        }
    }

    pub fn push(&mut self, bytes: &[u8]) {
        if bytes.len() >= self.capacity {
            self.data.clear();
            self.data
                .extend(&bytes[bytes.len().saturating_sub(self.capacity)..]);
            self.truncated = true;
            return;
        }
        let overflow = (self.data.len() + bytes.len()).saturating_sub(self.capacity);
        if overflow > 0 {
            self.data.drain(..overflow);
            self.truncated = true;
        }
        self.data.extend(bytes);
    }

    /// The buffered output for a replay. After truncation the first bytes may
    /// be the middle of a line or of an escape sequence, so the replay starts
    /// after the first line break.
    pub fn snapshot(&self) -> Vec<u8> {
        let (front, back) = self.data.as_slices();
        let mut out = Vec::with_capacity(self.data.len());
        out.extend_from_slice(front);
        out.extend_from_slice(back);
        if self.truncated
            && let Some(newline) = out.iter().position(|&byte| byte == b'\n')
        {
            out.drain(..=newline);
        }
        out
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_everything_below_capacity() {
        let mut ring = RingBuffer::new(16);
        ring.push(b"hello ");
        ring.push(b"world");
        assert_eq!(ring.snapshot(), b"hello world");
        assert_eq!(ring.len(), 11);
    }

    #[test]
    fn drops_oldest_bytes_and_starts_after_a_line_break() {
        let mut ring = RingBuffer::new(10);
        ring.push(b"one\ntwo\n");
        ring.push(b"three");
        // "one" was dropped; the kept "\ntwo\nthree" replays from "two".
        assert_eq!(ring.len(), 10);
        assert_eq!(ring.snapshot(), b"two\nthree");
    }

    #[test]
    fn keeps_a_truncated_buffer_without_line_breaks() {
        let mut ring = RingBuffer::new(4);
        ring.push(b"abcdef");
        assert_eq!(ring.snapshot(), b"cdef");
    }

    #[test]
    fn a_chunk_larger_than_the_capacity_keeps_its_tail() {
        let mut ring = RingBuffer::new(4);
        ring.push(b"xy");
        ring.push(b"12\n345");
        assert_eq!(ring.len(), 4);
        assert_eq!(ring.snapshot(), b"345");
    }

    #[test]
    fn empty_buffer() {
        let ring = RingBuffer::new(4);
        assert!(ring.is_empty());
        assert!(ring.snapshot().is_empty());
    }
}
