//! Incremental UTF-8 decoding of terminal output.

/// Decodes chunks of bytes into text. A multi-byte character split across two
/// chunks is kept until the rest arrives; invalid bytes become U+FFFD.
#[derive(Debug, Default)]
pub struct Utf8Decoder {
    pending: Vec<u8>,
}

impl Utf8Decoder {
    pub fn decode(&mut self, bytes: &[u8]) -> String {
        let mut input = std::mem::take(&mut self.pending);
        input.extend_from_slice(bytes);
        let complete = complete_prefix_len(&input);
        self.pending = input.split_off(complete);
        String::from_utf8_lossy(&input).into_owned()
    }
}

/// Length of the longest prefix that does not end with an incomplete
/// multi-byte sequence.
fn complete_prefix_len(bytes: &[u8]) -> usize {
    let len = bytes.len();
    for back in 1..=len.min(3) {
        let byte = bytes[len - back];
        if byte & 0b1100_0000 == 0b1000_0000 {
            continue; // continuation byte, look further back
        }
        let needed = match byte {
            _ if byte & 0b1110_0000 == 0b1100_0000 => 2,
            _ if byte & 0b1111_0000 == 0b1110_0000 => 3,
            _ if byte & 0b1111_1000 == 0b1111_0000 => 4,
            _ => 1,
        };
        return if needed > back { len - back } else { len };
    }
    len
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passes_ascii_through() {
        let mut decoder = Utf8Decoder::default();
        assert_eq!(decoder.decode(b"hello\x1b[0m"), "hello\x1b[0m");
    }

    #[test]
    fn joins_characters_split_across_chunks() {
        let text = "雨 → ✓";
        let bytes = text.as_bytes();
        for split in 0..=bytes.len() {
            let mut decoder = Utf8Decoder::default();
            let mut out = decoder.decode(&bytes[..split]);
            out.push_str(&decoder.decode(&bytes[split..]));
            assert_eq!(out, text, "split at {split}");
        }
    }

    #[test]
    fn keeps_four_byte_characters_intact() {
        let bytes = "🌧".as_bytes();
        let mut decoder = Utf8Decoder::default();
        assert_eq!(decoder.decode(&bytes[..1]), "");
        assert_eq!(decoder.decode(&bytes[1..3]), "");
        assert_eq!(decoder.decode(&bytes[3..]), "🌧");
    }

    #[test]
    fn replaces_invalid_bytes() {
        let mut decoder = Utf8Decoder::default();
        assert_eq!(decoder.decode(b"a\xffb"), "a\u{fffd}b");
    }
}
