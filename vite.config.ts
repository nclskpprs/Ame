/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

// Set by `tauri dev` when developing on a mobile device or a remote host.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  // svelteTesting resolves Svelte for the browser and cleans up after each
  // component test (only active under Vitest).
  plugins: [svelte(), ...(process.env.VITEST ? [svelteTesting()] : [])],
  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $locales: fileURLToPath(new URL('./locales', import.meta.url)),
    },
  },
  // Keep Rust errors visible in the terminal.
  clearScreen: false,
  server: {
    // Tauri expects a fixed port and fails if it is not available.
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // The Rust side is rebuilt by the Tauri CLI, not by Vite.
      ignored: ['**/src-tauri/**', '**/target/**'],
    },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_*'],
  build: {
    minify: !process.env.TAURI_ENV_DEBUG,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.svelte.ts'],
    environment: 'node',
  },
});
