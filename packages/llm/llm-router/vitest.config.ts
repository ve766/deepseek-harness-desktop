import { fileURLToPath } from 'node:url'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Reuse the repo-wide resolution facade (tsconfig.base.json) so every
// @deepseek-ai/* specifier resolves to its monorepo source, exactly like the
// root vitest config. Paths win over package exports so built lib/ never loads
// a second module-singleton copy.
const repoRootTsconfig = fileURLToPath(new URL('../../../tsconfig.base.json', import.meta.url))
const pkgRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: pkgRoot,
  plugins: [tsconfigPaths({ projects: [repoRootTsconfig] })],
  test: {
    environment: 'node',
    include: ['tests/**/*.spec.ts'],
    // One coverage invocation; forked workers keep Node stable on Windows.
    pool: 'forks',
  },
  coverage: {
    provider: 'v8',
    // Scope coverage to the three logic-bearing modules. `src/index.ts` is a
    // pure re-export barrel that v8 instruments as 0 statements; listing the
    // concrete files keeps the report unambiguous at 100%.
    include: ['src/service.ts', 'src/resolve.ts', 'src/types.ts'],
    // The environment's safe-delete shim rejects Vitest's coverage-dir cleanup
    // (rm) and otherwise aborts before the text report flushes. Disabling
    // cleanup lets the raw JSON report land on disk so the numbers survive; we
    // parse coverage-final.json directly.
    clean: false,
    reporter: ['text', 'json'],
    thresholds: {
      perFile: true,
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
})
