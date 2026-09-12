'use strict'

/**
 * Electron production main process.
 *
 * Replaces the development launcher (`electron/main.cjs`, which spawns `pnpm dsh
 * web` and hard-codes a 10s blind wait on localhost:3080). This production
 * launcher:
 *
 *   - carries its own web service as a node-mode child of the packaged Electron
 *     binary (`ELECTRON_RUN_AS_NODE=1`), so no pnpm or source tree is required;
 *   - parses the child's `DSH_WEB_URL=` ready line instead of sleeping;
 *   - hardens the renderer (sandbox + no node integration);
 *   - kills the server child on window close / app quit.
 *
 * The service closure lives at `electron/server` (built by `pnpm build:server`),
 * so it ships inside the packaged app via the `electron/**/*` files glob.
 */

const { app, BrowserWindow } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const SERVER_READY_TIMEOUT_MS = 30000

/**
 * Locate the bundled server entry. Works whether the app is asar-packed
 * (`resources/app.asar/electron/...`, unpacked to `app.asar.unpacked`) or runs
 * as loose files (`resources/app/electron/...`).
 * @returns {string} absolute path to `lib/electron-server-entry.js`.
 */
function resolveServerEntry() {
  const base = __dirname // .../electron (inside app root or app.asar)
  // The closure lives INSIDE the electron/ folder: app-root/electron/server/.
  const loose = path.join(base, 'server', 'lib', 'electron-server-entry.js')
  if (fs.existsSync(loose)) return loose

  const asarRoot = path.resolve(base, '..')
  if (asarRoot.endsWith('.asar')) {
    const unpacked = path.join(asarRoot, '..', 'app.asar.unpacked', 'electron', 'server', 'lib', 'electron-server-entry.js')
    if (fs.existsSync(unpacked)) return unpacked
  }
  return loose // best-effort; the spawn error surfaces a clear message
}

/**
 * Spawn the bundled web service and resolve once it prints `DSH_WEB_URL=`.
 * @returns {Promise<{ child: import('child_process').ChildProcess; url: string }>}
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const entry = resolveServerEntry()
    if (!fs.existsSync(entry)) {
      reject(new Error(
        `Server entry not found: ${entry}\n` +
        'Build the runtime closure first: `pnpm build:server` (then repackage with `electron-builder --dir`).',
      ))
      return
    }

    const child = spawn(process.execPath, [entry], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let url = null
    let stderrBuf = ''
    const onStdout = (chunk) => {
      const text = chunk.toString()
      for (const line of text.split(/\r?\n/)) {
        const m = line.match(/^DSH_WEB_URL=(.+)$/)
        if (m) {
          const candidate = m[1].trim()
          if (candidate) {
            url = candidate
            resolve({ child, url })
            return
          }
        }
      }
    }
    const onStderr = (chunk) => { stderrBuf += chunk.toString() }
    const tail = () => stderrBuf.slice(-2000)

    child.stdout.on('data', onStdout)
    child.stderr.on('data', onStderr)
    child.on('error', (err) => reject(new Error(`Failed to spawn server: ${err.message}`)))
    child.on('exit', (code, sig) => {
      if (!url) reject(new Error(`Server exited before ready (code=${code} signal=${sig})\n${tail()}`))
    })
    setTimeout(() => {
      if (!url) reject(new Error(`Server did not report DSH_WEB_URL within ${SERVER_READY_TIMEOUT_MS}ms\n${tail()}`))
    }, SERVER_READY_TIMEOUT_MS)
  })
}

/** Show a minimal error window so a launch failure is visible, not silent. */
function showError(message) {
  const escaped = String(message).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c])
  const win = new BrowserWindow({ width: 760, height: 520, show: true, autoHideMenuBar: true })
  win.loadURL('data:text/html,' + encodeURIComponent(
    `<!doctype html><html><head><meta charset="utf-8"><title>启动失败</title></head>` +
    `<body style="font-family:system-ui,sans-serif;padding:28px;color:#222">` +
    `<h2>启动失败</h2>` +
    `<p>本地服务未能启动。如为首次运行，请先执行构建：<code>pnpm dist:portable</code>。</p>` +
    `<pre style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px">${escaped}</pre>` +
    `</body></html>`,
  ))
  return win
}

let server = null

async function main() {
  try {
    server = await startServer()
  } catch (err) {
    console.error(err)
    showError(err && err.message ? err.message : String(err))
    return
  }

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.loadURL(server.url)

  const stopServer = () => {
    if (server && server.child && !server.child.killed) {
      server.child.kill('SIGTERM')
      server = null
    }
  }
  win.on('closed', stopServer)
  app.on('quit', stopServer)
}

app.whenReady().then(main).catch((err) => {
  console.error(err)
  showError(err && err.message ? err.message : String(err))
})
