#!/usr/bin/env node
// Measures startup time and idle memory of a release build of Ame with three
// open projects (docs/VISION.md: < 150 MB RAM idle, cold start < 1 s).
//
//   pnpm tauri build --no-bundle
//   node scripts/bench.mjs [--binary <path>] [--runs <n>] [--no-fail]
//
// The app measures itself (`AME_BENCH`, see src-tauri/src/bench.rs) and
// quits. On Linux without a display, run it under `xvfb-run`. In GitHub
// Actions the result is added to the job summary.

import { spawn } from 'node:child_process';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

/** Targets from docs/VISION.md. */
const BUDGET = { memoryMb: 150, startupMs: 1000 };
const RUN_TIMEOUT_MS = 60_000;

const { values } = parseArgs({
  options: {
    binary: { type: 'string' },
    runs: { type: 'string', default: '3' },
    'no-fail': { type: 'boolean', default: false },
  },
});

const exe = process.platform === 'win32' ? 'ame.exe' : 'ame';
const binary = resolve(values.binary ?? join('target', 'release', exe));
if (!existsSync(binary)) {
  console.error(`No binary at ${binary}. Build it with: pnpm tauri build --no-bundle`);
  process.exit(2);
}
const runs = Math.max(1, Number.parseInt(values.runs, 10) || 1);

/** A config dir with three small projects open, the first one active. */
function prepare(root) {
  const config = join(root, 'config');
  mkdirSync(config);
  const projects = ['alpha', 'beta', 'gamma'].map((name) => {
    const path = join(root, name);
    mkdirSync(join(path, 'src'), { recursive: true });
    writeFileSync(join(path, 'README.md'), `# ${name}\n`);
    writeFileSync(join(path, 'src', 'main.ts'), 'export const answer = 42;\n');
    return { path, name, group: null, pinned: false, muted: false };
  });
  writeFileSync(
    join(config, 'workspace.json'),
    JSON.stringify({ version: 1, projects, active: projects[0].path }),
  );
  return config;
}

function runOnce(root, index) {
  const config = prepare(mkdtempSync(join(root, `run${index}-`)));
  const output = join(config, 'bench.json');
  return new Promise((done, fail) => {
    const child = spawn(binary, [], {
      env: { ...process.env, AME_CONFIG_DIR: config, AME_BENCH: output },
      stdio: ['ignore', 'ignore', 'inherit'],
    });
    const timer = setTimeout(() => {
      child.kill();
      fail(new Error(`run ${index + 1} did not finish within ${RUN_TIMEOUT_MS / 1000} s`));
    }, RUN_TIMEOUT_MS);
    child.on('error', fail);
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code !== 0 || !existsSync(output)) {
        fail(new Error(`run ${index + 1} exited with code ${code} and no result`));
        return;
      }
      done(JSON.parse(readFileSync(output, 'utf8')));
    });
  });
}

function median(numbers) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const root = mkdtempSync(join(tmpdir(), 'ame-bench-'));
const results = [];
try {
  for (let i = 0; i < runs; i++) {
    const result = await runOnce(root, i);
    results.push(result);
    console.log(
      `run ${i + 1}: startup ${result.startupMs.toFixed(0)} ms, memory ${result.memoryMb.toFixed(1)} MB`,
    );
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}

const startup = median(results.map((r) => r.startupMs));
const memory = median(results.map((r) => r.memoryMb));
const over = [];
if (memory > BUDGET.memoryMb) over.push(`memory ${memory.toFixed(1)} MB > ${BUDGET.memoryMb} MB`);
if (startup > BUDGET.startupMs)
  over.push(`startup ${startup.toFixed(0)} ms > ${BUDGET.startupMs} ms`);

const last = results.at(-1);
const lines = [
  `### Ame benchmark (${last.os}, ${runs} runs, median)`,
  '',
  '| Metric | Result | Budget |',
  '| --- | --- | --- |',
  `| Startup to first frame | ${startup.toFixed(0)} ms | < ${BUDGET.startupMs} ms |`,
  `| Memory (${last.memoryKind.toUpperCase()}), idle, 3 projects | ${memory.toFixed(1)} MB | < ${BUDGET.memoryMb} MB |`,
  '',
  'Processes (last run):',
  '',
  ...last.processes.map((p) => `- ${p.name}: ${p.memoryMb.toFixed(1)} MB`),
  '',
];
console.log(lines.join('\n'));
if (process.env.GITHUB_STEP_SUMMARY)
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));

if (over.length > 0) {
  console.error(`Over budget: ${over.join(', ')}`);
  if (!values['no-fail']) process.exit(1);
}
