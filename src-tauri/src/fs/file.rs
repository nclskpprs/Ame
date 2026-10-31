//! Reading and writing text files for the editor.

use std::fs;
use std::io::Read;
use std::path::Path;

use serde::Serialize;
use specta::Type;

use super::path::resolve;
use crate::error::Result;

/// Files above this size are not opened in the editor.
pub const MAX_TEXT_FILE_BYTES: u64 = 10 * 1024 * 1024;

/// Bytes inspected to detect binary files.
const SNIFF_BYTES: usize = 8 * 1024;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FileContent {
    Text {
        text: String,
    },
    /// Binary or not valid UTF-8.
    Binary,
    TooLarge {
        megabytes: u32,
    },
}

pub fn read_file(root: &Path, rel: &str) -> Result<FileContent> {
    let path = resolve(root, rel)?;
    let size = fs::metadata(&path)?.len();
    if size > MAX_TEXT_FILE_BYTES {
        let megabytes = u32::try_from(size / (1024 * 1024)).unwrap_or(u32::MAX);
        return Ok(FileContent::TooLarge { megabytes });
    }

    let mut bytes = Vec::new();
    fs::File::open(&path)?.read_to_end(&mut bytes)?;
    if bytes.iter().take(SNIFF_BYTES).any(|&byte| byte == 0) {
        return Ok(FileContent::Binary);
    }
    Ok(match String::from_utf8(bytes) {
        Ok(text) => FileContent::Text { text },
        Err(_) => FileContent::Binary,
    })
}

/// Writes a file in place (not via rename), so permissions, symlinks and
/// hard links are preserved.
pub fn write_file(root: &Path, rel: &str, text: &str) -> Result<()> {
    let path = resolve(root, rel)?;
    fs::write(path, text)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn reads_text_and_detects_binary() {
        let dir = TempDir::new().unwrap();
        fs::write(dir.path().join("a.txt"), "héllo\r\n").unwrap();
        fs::write(dir.path().join("b.bin"), [0u8, 1, 2]).unwrap();
        fs::write(dir.path().join("c.txt"), [0xffu8, 0xfe, 0x41]).unwrap();

        assert_eq!(
            read_file(dir.path(), "a.txt").unwrap(),
            FileContent::Text {
                text: "héllo\r\n".into()
            }
        );
        assert_eq!(read_file(dir.path(), "b.bin").unwrap(), FileContent::Binary);
        assert_eq!(read_file(dir.path(), "c.txt").unwrap(), FileContent::Binary);
    }

    #[test]
    fn writes_in_place() {
        let dir = TempDir::new().unwrap();
        write_file(dir.path(), "a.txt", "one").unwrap();
        write_file(dir.path(), "a.txt", "two").unwrap();
        assert_eq!(fs::read_to_string(dir.path().join("a.txt")).unwrap(), "two");
        assert!(write_file(dir.path(), "../x.txt", "no").is_err());
    }
}
