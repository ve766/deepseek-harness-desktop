/**
 * Deploy the `dsh` runtime closure into `electron/server` so the packaged
 * Electron app can launch it as a node-mode child (`ELECTRON_RUN_AS_NODE=1`)
 * without pnpm or a source tree.
 *
 * This mirrors the proven deploy path in `build-exe-for-python-sdk.ts`
 * (`deployStaging` + `restoreLegacyHoists` + `materializeStagedLinks`): pnpm
 * `--legacy --prod` produces a hoisted, partly-symlinked closure, and the two
 * post-fixes turn it into a flat, symlink-free, self-contained node tree that
 * Cordis's runtime bare-package imports can resolve from anywhere.
 *
 * The deployed entry is `electron/server/lib/electron-server-entry.js` (built by
 * `tsc -b tsconfig.host.json && tsdown` before this script runs). The closure
 * transitively includes `@deepseek-ai/dsh-web-app` → every web plugin and
 * `@deepseek-ai/dsh-web-frontend` (with its built `dist/`), so the web service
 * boots and serves the UI with no external dependency.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { cp, lstat, mkdir, readdir, readFile, realpath } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')

/** The closure manifest whose dependencies define the deployed runtime. */
const DEPLOY_ROOT_PACKAGE = '@deepseek-ai/dsh'
/** The cleared deploy target — ships inside the packaged app via `electron/**\/*`. */
const STAGING = resolve(root, 'electron', 'server')
/** Legacy deploy may hoist peer-specialized workspace packages back here. */
const DEPLOY_SOURCE_NODE_MODULES = resolve(root, 'node_modules')
/** The closed-runtime entry that the Electron main process spawns. */
const ENTRY = 'lib/electron-server-entry.js'

function pnpmBin(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].map(part => (part.includes(' ') ? JSON.stringify(part) : part)).join(' ')
}

class ServerDeploy {
  private readonly staging = STAGING
  private dryRun = false

  constructor(dryRun: boolean) {
    this.dryRun = dryRun
  }

  /** Build the symlink-free runtime closure in {@link STAGING}. */
  async run(): Promise<void> {
    if (this.staging === root || root.startsWith(this.staging + sep)) {
      throw new Error(`build-electron-server-deploy: refusing to clear staging dir ${this.staging}: it contains the repo root.`)
    }
    if (this.dryRun) console.log(`build-electron-server-deploy: [dry-run] rm -rf ${this.staging}`)
    else await rm(this.staging, { recursive: true, force: true })

    await this.deployStaging()
    await this.restoreLegacyHoists()
    await this.materializeStagedLinks()
    await this.verifyEntry()
  }

  private async deployStaging(): Promise<void> {
    await this.runSubprocess('deploy', pnpmBin(), [
      '--filter',
      DEPLOY_ROOT_PACKAGE,
      'deploy',
      '--legacy',
      '--prod',
      '--config.node-linker=hoisted',
      '--config.auto-install-peers=false',
      '--config.link-workspace-packages=true',
      this.staging,
    ])
  }

  /**
   * Restore direct packages that pnpm's legacy hoister places beside the deploy
   * source instead of in the target. The runtime manifest supplies every peer,
   * so package-local node_modules trees are omitted to preserve one flat Cordis
   * instance and a symlink-free packaged payload.
   */
  private async restoreLegacyHoists(): Promise<void> {
    if (this.dryRun) {
      console.log('build-electron-server-deploy: [dry-run] restore direct dependencies omitted by legacy deploy')
      return
    }
    const manifestPath = join(this.staging, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const restored: string[] = []
    for (const dependency of Object.keys(manifest.dependencies ?? {}).sort()) {
      const destination = join(this.staging, 'node_modules', dependency)
      if (existsSync(destination)) continue
      const source = join(DEPLOY_SOURCE_NODE_MODULES, dependency)
      if (!existsSync(source)) {
        throw new Error(
          `build-electron-server-deploy: deployed dependency ${dependency} is absent from both ${destination} and ${source}.`,
        )
      }
      await mkdir(dirname(destination), { recursive: true })
      const nestedNodeModules = join(source, 'node_modules')
      await cp(source, destination, {
        recursive: true,
        dereference: true,
        filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
      })
      restored.push(dependency)
    }
    const stillMissing = Object.keys(manifest.dependencies ?? {})
      .filter(dependency => !existsSync(join(this.staging, 'node_modules', dependency)))
    if (stillMissing.length > 0) {
      throw new Error(`build-electron-server-deploy: staged dependencies remain missing: ${stillMissing.join(', ')}.`)
    }
    if (restored.length > 0) {
      console.log(`build-electron-server-deploy: restored legacy deploy hoists: ${restored.join(', ')}`)
    }
  }

  /** Replace deploy-time package links with files and reject any remaining link. */
  private async materializeStagedLinks(): Promise<void> {
    if (this.dryRun) {
      console.log('build-electron-server-deploy: [dry-run] materialize staged package links')
      return
    }
    const nodeModules = join(this.staging, 'node_modules')
    let remaining = await this.findSymlink(nodeModules)
    while (remaining !== undefined) {
      const segments = remaining.slice(nodeModules.length + 1).split(sep)
      const binIndex = segments.lastIndexOf('.bin')
      if (binIndex >= 0) {
        await rm(join(nodeModules, ...segments.slice(0, binIndex + 1)), { recursive: true, force: true })
        remaining = await this.findSymlink(nodeModules)
        continue
      }
      const destination = remaining
      const source = await realpath(destination)
      const nestedNodeModules = join(source, 'node_modules')
      await rm(destination, { recursive: true, force: true })
      await cp(source, destination, {
        recursive: true,
        dereference: true,
        filter: path => path !== nestedNodeModules && !path.startsWith(nestedNodeModules + sep),
      })
      remaining = await this.findSymlink(nodeModules)
    }
  }

  /** Return the first symbolic link below a directory, if one exists. */
  private async findSymlink(directory: string): Promise<string | undefined> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      const metadata = await lstat(path)
      if (metadata.isSymbolicLink()) return path
      if (metadata.isDirectory()) {
        const nested = await this.findSymlink(path)
        if (nested !== undefined) return nested
      }
    }
    return undefined
  }

  /** Fail loudly if the expected entry is missing after deploy. */
  private async verifyEntry(): Promise<void> {
    const entryPath = join(this.staging, ENTRY)
    if (this.dryRun) {
      console.log(`build-electron-server-deploy: [dry-run] would require ${entryPath}`)
      return
    }
    if (!existsSync(entryPath)) {
      throw new Error(
        `build-electron-server-deploy: ${entryPath} missing — run \`pnpm build:lib:host\` so lib/electron-server-entry.js exists before deploying.`,
      )
    }
    console.log(`build-electron-server-deploy: deployed runtime closure to ${this.staging}`)
  }

  private async runSubprocess(label: string, command: string, args: string[]): Promise<void> {
    const printable = formatCommand(command, args)
    if (this.dryRun) {
      console.log(`build-electron-server-deploy: [dry-run] ${printable}`)
      return
    }
    console.log(`build-electron-server-deploy: ${label}: ${printable}`)
    await new Promise<void>((resolvePromise, reject) => {
      const child = spawn(command, args, {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, CI: 'true' },
      })
      child.once('error', (error) => {
        reject(new Error(`build-electron-server-deploy: ${label} failed to spawn: ${error.message} (${printable})`))
      })
      child.once('exit', (code, signal) => {
        if (code === 0) {
          resolvePromise()
          return
        }
        const cause = code === null ? `signal ${signal ?? 'unknown'}` : `exit code ${code}`
        reject(new Error(`build-electron-server-deploy: ${label} failed (${cause}): ${printable}`))
      })
    })
  }
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run')
  await new ServerDeploy(dryRun).run()
}

await main()
