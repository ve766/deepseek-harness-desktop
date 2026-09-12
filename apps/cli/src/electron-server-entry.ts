/**
 * Electron production server entry.
 *
 * Runs as a node-mode carrier under the packaged Electron binary
 * (`ELECTRON_RUN_AS_NODE=1`) and boots the `web` profile, then prints a single
 * machine-readable ready line:
 *
 *   DSH_WEB_URL=http://127.0.0.1:<port>
 *
 * The Electron main process (`electron/production.cjs`) parses this line to
 * learn when the local web service is ready and which URL to load.
 *
 * This file is a thin launch adapter. It reuses the existing `runProfile` API
 * and never touches runtime, Agent Core, the slot/web contracts, or the
 * Knowledge API. Spawning strategy (localhost HTTP/WS served by a bundled node
 * carrier) is the only thing that changes versus `dsh web` in development.
 *
 * @module @deepseek-ai/dsh/electron-server-entry
 */

import { runProfile } from './profile-boot.ts'
import { loadLayeredEnv } from '@deepseek-ai/dsh-app-boot'

/** Loopback bind — never expose the local agent runtime to the network. */
const HOST = '127.0.0.1'
/** Port 0 lets the OS assign a free port; the bound value is printed back. */
const PORT = 0
/** How long to wait for the webServer service to report a bound port. */
const BIND_TIMEOUT_MS = 15000

interface WebServerService {
  readonly host: string
  readonly port: number
}

async function main(): Promise<void> {
  const { ctx } = await runProfile({
    environment: loadLayeredEnv('dsh'),
    profile: 'web',
    patchFiles: [],
    args: ['--host', HOST, '--port', String(PORT)],
  })

  // The webserver service binds during boot; sample its listening port.
  let webServer: WebServerService | undefined
  try {
    webServer = ctx.get('webServer') as unknown as WebServerService
  } catch {
    webServer = undefined
  }

  const deadline = Date.now() + BIND_TIMEOUT_MS
  let boundPort: number | undefined
  while (Date.now() < deadline) {
    if (webServer !== undefined && typeof webServer.port === 'number' && webServer.port > 0) {
      boundPort = webServer.port
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  if (boundPort === undefined) {
    throw new Error('electron-server-entry: webServer did not bind a listening port within the timeout.')
  }

  // Single, parseable ready signal for the Electron main process.
  process.stdout.write(`DSH_WEB_URL=http://${HOST}:${boundPort}\n`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`electron-server-entry failed:\n${message}\n`)
  process.exit(1)
})
