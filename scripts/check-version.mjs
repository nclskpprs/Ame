#!/usr/bin/env node
// Checks that a release tag (e.g. `v0.1.0`) matches the version in
// Cargo.toml (workspace) and package.json. Used by the release workflow.
//
//   node scripts/check-version.mjs v0.1.0

import { readFileSync } from 'node:fs';

const tag = process.argv[2] ?? '';
const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag);
if (!match) {
  console.error(`"${tag}" is not a version tag like v0.1.0`);
  process.exit(1);
}
const version = match[1];

const cargo = readFileSync('Cargo.toml', 'utf8');
const section = cargo.split('[workspace.package]')[1] ?? '';
const cargoVersion = /^version\s*=\s*"([^"]+)"/m.exec(section)?.[1];
const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;

const wrong = [
  ['Cargo.toml [workspace.package]', cargoVersion],
  ['package.json', packageVersion],
].filter(([, found]) => found !== version);

if (wrong.length > 0) {
  for (const [file, found] of wrong)
    console.error(`${file} has version ${found}, the tag says ${version}`);
  process.exit(1);
}
console.log(`Version ${version} matches the tag.`);
