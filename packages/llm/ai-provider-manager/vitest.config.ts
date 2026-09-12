/**
 * Dedicated test config for the AI Provider Manager.
 *
 * Runs standalone (no repo-wide setup file) so the package stays independent of
 * the cordis invariant tree — it needs no `src/invariant.ts` companion and no
 * dependency on `@deepseek-ai/dsh-invariants`. `root` is pinned to this package
 * directory so test and coverage globs resolve locally regardless of where
 * Vitest is invoked from. Coverage holds the repo's 100% per-file gate for this
 * package's own sources.
 */
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { defineConfig } from 'vitest/config'

const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  test: {
    name: 'ai-provider-manager',
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // Disable Vitest's own coverage-dir cleanup: the environment's safe-delete
      // shim rejects directory removal and otherwise aborts the run (before the
      // report flushes). Reports are read from disk afterwards.
      clean: false,
      cleanOnRerun: false,
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      // Types-only file: no executable statements to cover.
      exclude: ['src/types.ts'],
      thresholds: {
        perFile: true,
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
})
