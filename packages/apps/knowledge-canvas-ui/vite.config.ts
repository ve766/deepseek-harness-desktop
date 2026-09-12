import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard config for the prototype. Run via `pnpm --filter @deepseek-ai/dsh-knowledge-canvas-ui dev`
// once the workspace lockfile is regenerated (the lockfile change is a SEPARATE commit per repo discipline).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      // Two independent entry bundles:
      //   main -> index.html  (real App Shell)
      //   p3   -> p3.html     (P3Showcase regression surface, captured by
      //                        scripts/capture-showcase.cjs against localhost:8099)
      input: {
        main: 'index.html',
        p3: 'p3.html',
      },
    },
  },
})
