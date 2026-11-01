//! On-demand text search (ripgrep libraries). Results are streamed to the
//! frontend in batches; starting a new search cancels the running one.

use std::path::Path;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use grep_matcher::Matcher;
use grep_regex::{RegexMatcher, RegexMatcherBuilder};
use grep_searcher::sinks::UTF8;
use grep_searcher::{BinaryDetection, SearcherBuilder};
use serde::{Deserialize, Serialize};
use specta::Type;

use super::path::relative;
use super::walk::project_walker;
use crate::error::{Error, Result};

/// Stop after this many matching lines.
const MAX_MATCHES: u32 = 5_000;
/// Lines are cut to this many characters around the first match.
const MAX_LINE_CHARS: usize = 240;
/// Send a batch at least this often while searching.
const BATCH_INTERVAL: Duration = Duration::from_millis(80);

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub regex: bool,
    pub whole_word: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FileResults {
    pub path: String,
    pub lines: Vec<LineMatch>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct LineMatch {
    /// 1-based line number.
    pub line: u32,
    /// The (possibly shortened) line text.
    pub text: String,
    /// Column of `text`'s first character in the full line (UTF-16 units).
    pub offset: u32,
    /// Matched ranges in `text`, in UTF-16 code units.
    pub ranges: Vec<MatchRange>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct MatchRange {
    pub start: u32,
    pub end: u32,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct SearchSummary {
    pub files: u32,
    pub matches: u32,
    /// The match limit was reached.
    pub truncated: bool,
    /// A newer search replaced this one.
    pub cancelled: bool,
}

/// Hands out search generations; a search stops when a newer one starts.
/// Cheap to clone; clones share the generation counter.
#[derive(Debug, Clone, Default)]
pub struct SearchControl {
    generation: Arc<AtomicU64>,
}

impl SearchControl {
    pub fn start(&self) -> u64 {
        self.generation.fetch_add(1, Ordering::SeqCst) + 1
    }

    pub fn cancel(&self) {
        self.generation.fetch_add(1, Ordering::SeqCst);
    }

    fn is_current(&self, generation: u64) -> bool {
        self.generation.load(Ordering::SeqCst) == generation
    }
}

pub fn build_matcher(query: &str, options: &SearchOptions) -> Result<RegexMatcher> {
    RegexMatcherBuilder::new()
        .case_insensitive(!options.case_sensitive)
        .fixed_strings(!options.regex)
        .word(options.whole_word)
        .build(query)
        .map_err(|err| Error::InvalidSearch(err.to_string()))
}

/// Searches all files of a project. `emit` receives batches of results.
pub fn search(
    root: &Path,
    matcher: &RegexMatcher,
    control: &SearchControl,
    generation: u64,
    mut emit: impl FnMut(Vec<FileResults>),
) -> SearchSummary {
    let mut searcher = SearcherBuilder::new()
        .line_number(true)
        .binary_detection(BinaryDetection::quit(0))
        .build();
    let mut summary = SearchSummary::default();
    let mut batch = Vec::new();
    let mut last_emit = Instant::now();

    for entry in project_walker(root).build().filter_map(Result::ok) {
        if !control.is_current(generation) {
            summary.cancelled = true;
            break;
        }
        if !entry.file_type().is_some_and(|kind| kind.is_file()) {
            continue;
        }
        let Some(path) = relative(root, entry.path()) else {
            continue;
        };

        let mut lines = Vec::new();
        let budget = MAX_MATCHES - summary.matches;
        // Unreadable or non-UTF-8 files are skipped.
        let _ = searcher.search_path(
            matcher,
            entry.path(),
            UTF8(|line_number, line| {
                lines.push(line_match(matcher, line_number, line));
                Ok((lines.len() as u32) < budget)
            }),
        );
        if lines.is_empty() {
            continue;
        }

        summary.files += 1;
        summary.matches += lines.len() as u32;
        batch.push(FileResults { path, lines });
        if summary.matches >= MAX_MATCHES {
            summary.truncated = true;
            break;
        }
        if last_emit.elapsed() >= BATCH_INTERVAL {
            emit(std::mem::take(&mut batch));
            last_emit = Instant::now();
        }
    }

    if !batch.is_empty() && !summary.cancelled {
        emit(batch);
    }
    summary
}

fn line_match(matcher: &RegexMatcher, line_number: u64, line: &str) -> LineMatch {
    let line = line.trim_end_matches(['\r', '\n']);
    let mut byte_ranges = Vec::new();
    let _ = matcher.find_iter(line.as_bytes(), |m| {
        byte_ranges.push((m.start(), m.end()));
        true
    });

    // Keep some context before the first match, then cut long lines.
    let first = byte_ranges.first().map_or(0, |range| range.0);
    let start = floor_char_boundary(line, first.saturating_sub(40));
    let end = line
        .char_indices()
        .map(|(index, _)| index)
        .filter(|&index| index > start)
        .nth(MAX_LINE_CHARS)
        .unwrap_or(line.len());
    let text = &line[start..end];

    let utf16 = |byte: usize| line[start..byte.clamp(start, end)].encode_utf16().count() as u32;
    LineMatch {
        line: u32::try_from(line_number).unwrap_or(u32::MAX),
        text: text.to_owned(),
        offset: line[..start].encode_utf16().count() as u32,
        ranges: byte_ranges
            .into_iter()
            .filter(|&(from, _)| from < end)
            .map(|(from, to)| MatchRange {
                start: utf16(from),
                end: utf16(to),
            })
            .collect(),
    }
}

fn floor_char_boundary(text: &str, mut index: usize) -> usize {
    while !text.is_char_boundary(index) {
        index -= 1;
    }
    index
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn run(root: &Path, query: &str, options: &SearchOptions) -> (Vec<FileResults>, SearchSummary) {
        let matcher = build_matcher(query, options).unwrap();
        let control = SearchControl::default();
        let generation = control.start();
        let mut results = Vec::new();
        let summary = search(root, &matcher, &control, generation, |batch| {
            results.extend(batch)
        });
        results.sort_by(|a, b| a.path.cmp(&b.path));
        (results, summary)
    }

    fn project() -> TempDir {
        let dir = TempDir::new().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::create_dir_all(root.join("dist")).unwrap();
        fs::write(root.join(".gitignore"), "dist\n").unwrap();
        fs::write(
            root.join("src/a.ts"),
            "const Foo = 1;\nlet foo = Foo + foobar;\n",
        )
        .unwrap();
        fs::write(root.join("src/b.md"), "Ünïcode foo here\n").unwrap();
        fs::write(root.join("dist/out.js"), "foo").unwrap();
        fs::write(root.join("src/bin.dat"), b"foo\0\0").unwrap();
        dir
    }

    #[test]
    fn finds_matches_case_insensitive_by_default() {
        let dir = project();
        let (results, summary) = run(dir.path(), "foo", &SearchOptions::default());
        assert_eq!(
            results.iter().map(|r| r.path.as_str()).collect::<Vec<_>>(),
            ["src/a.ts", "src/b.md"]
        );
        assert_eq!(summary.files, 2);
        assert_eq!(summary.matches, 3);
        let line = &results[0].lines[1];
        assert_eq!(line.line, 2);
        assert_eq!(line.ranges.len(), 3);
    }

    #[test]
    fn respects_options() {
        let dir = project();
        let case = SearchOptions {
            case_sensitive: true,
            ..SearchOptions::default()
        };
        assert_eq!(run(dir.path(), "Foo", &case).1.matches, 2);

        let word = SearchOptions {
            whole_word: true,
            ..SearchOptions::default()
        };
        let (results, _) = run(dir.path(), "foo", &word);
        assert_eq!(results[0].lines[1].ranges.len(), 2);

        let regex = SearchOptions {
            regex: true,
            ..SearchOptions::default()
        };
        assert_eq!(run(dir.path(), "fo+bar", &regex).1.matches, 1);
        assert!(matches!(
            build_matcher("(", &regex),
            Err(Error::InvalidSearch(_))
        ));
    }

    #[test]
    fn ranges_are_utf16_offsets() {
        let dir = project();
        let (results, _) = run(dir.path(), "foo", &SearchOptions::default());
        let line = &results[1].lines[0];
        assert_eq!(line.text, "Ünïcode foo here");
        assert_eq!(line.ranges, [MatchRange { start: 8, end: 11 }]);
    }

    #[test]
    fn cancelled_search_stops() {
        let dir = project();
        let matcher = build_matcher("foo", &SearchOptions::default()).unwrap();
        let control = SearchControl::default();
        let generation = control.start();
        control.cancel();
        let summary = search(dir.path(), &matcher, &control, generation, |_| {});
        assert!(summary.cancelled);
        assert_eq!(summary.matches, 0);
    }

    #[test]
    fn long_lines_are_shortened_around_the_match() {
        let matcher = build_matcher("needle", &SearchOptions::default()).unwrap();
        let line = format!("{}needle{}", "a".repeat(500), "b".repeat(500));
        let result = line_match(&matcher, 1, &line);
        assert_eq!(result.offset, 460);
        assert_eq!(result.ranges, [MatchRange { start: 40, end: 46 }]);
        assert!(result.text.chars().count() <= MAX_LINE_CHARS + 1);
    }
}
