import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  cpSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import https from 'node:https'
import http from 'node:http'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'))
const appVersion = packageJson.version
const artifactDir = join(repoRoot, 'artifacts', 'runtime')
const assetBaseName = `drodo-runtime-linux-x64-${appVersion}.tar.gz`
const assetPath = join(artifactDir, assetBaseName)
const checksumPath = `${assetPath}.sha256`
const cacheDir = join(repoRoot, '.cache', 'automation-runtime', 'linux')
const downloadsDir = join(cacheDir, 'downloads')
const workDir = join(cacheDir, 'work')
const buildCacheDir = join(cacheDir, 'npm-cache')
const buildTempDir = join(cacheDir, 'tmp')
const stateFile = join(cacheDir, 'bundle-state.json')
const payloadDir = join(workDir, 'payload')
const nodeExtractDir = join(workDir, 'node-extract')

const runtimeConfig = {
  runtimeVersion: appVersion,
  nodeVersion: '24.14.0',
  n8nVersion: '2.15.0',
  gitVersion: null,
  platform: 'linux-x64',
  nodeUrl: 'https://nodejs.org/dist/v24.14.0/node-v24.14.0-linux-x64.tar.xz',
}

if (process.platform !== 'linux') {
  console.log('Skipping Linux runtime build on non-Linux host.')
  process.exit(0)
}

for (const dir of [artifactDir, downloadsDir, workDir, buildCacheDir, buildTempDir]) {
  mkdirSync(dir, { recursive: true })
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: false,
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}.`)
  }
}

function resetDirectory(path) {
  rmSync(path, { recursive: true, force: true })
  mkdirSync(path, { recursive: true })
}

function readJsonFile(path) {
  if (!existsSync(path)) {
    return null
  }

  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function writeTextFile(path, contents) {
  writeFileSync(path, contents, 'utf8')
}

function writeJsonFile(path, value) {
  writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

function getBundleState() {
  return {
    runtimeVersion: runtimeConfig.runtimeVersion,
    nodeVersion: runtimeConfig.nodeVersion,
    n8nVersion: runtimeConfig.n8nVersion,
    gitVersion: runtimeConfig.gitVersion,
    platform: runtimeConfig.platform,
    assetPath,
    checksumPath,
  }
}

function isBundleCurrent() {
  const state = readJsonFile(stateFile)
  if (!state || !existsSync(assetPath) || !existsSync(checksumPath)) {
    return false
  }

  const expected = getBundleState()
  return Object.entries(expected).every(([key, value]) => state[key] === value)
}

async function downloadFile(url, destination, redirectCount = 0) {
  if (existsSync(destination)) {
    return
  }

  const client = url.startsWith('https:') ? https : http

  await new Promise((resolvePromise, rejectPromise) => {
    const request = client.get(url, response => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume()
        if (redirectCount >= 5) {
          rejectPromise(new Error(`Too many redirects downloading ${url}`))
          return
        }
        downloadFile(response.headers.location, destination, redirectCount + 1).then(resolvePromise, rejectPromise)
        return
      }

      if (response.statusCode !== 200) {
        rejectPromise(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`))
        return
      }

      const output = createWriteStream(destination)
      pipeline(response, output).then(resolvePromise, rejectPromise)
    })

    request.on('error', rejectPromise)
  })
}

function getSingleExtractedDirectory(root) {
  const entries = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory())
  if (entries.length !== 1) {
    throw new Error(`Expected exactly one extracted directory under ${root}, found ${entries.length}.`)
  }
  return join(root, entries[0].name)
}

async function hashFile(path) {
  const hash = createHash('sha256')
  const stream = createReadStream(path)
  for await (const chunk of stream) {
    hash.update(chunk)
  }
  return hash.digest('hex')
}

async function writeChecksumFile(filePath, destination) {
  const hash = await hashFile(filePath)
  writeTextFile(destination, `${hash}  ${basename(filePath)}\n`)
}

async function main() {
  if (isBundleCurrent()) {
    console.log(`Linux runtime artifact is up to date at ${assetPath}`)
    return
  }

  resetDirectory(payloadDir)
  resetDirectory(nodeExtractDir)

  const nodeArchive = join(downloadsDir, basename(runtimeConfig.nodeUrl))
  await downloadFile(runtimeConfig.nodeUrl, nodeArchive)
  run('tar', ['-xf', nodeArchive, '-C', nodeExtractDir])

  const nodeRoot = getSingleExtractedDirectory(nodeExtractDir)
  const nodeTarget = join(payloadDir, 'node')
  const prefixTarget = join(payloadDir, 'prefix')
  const binTarget = join(payloadDir, 'bin')
  const dataTarget = join(payloadDir, 'data')
  const logsTarget = join(payloadDir, 'logs')
  const tempTarget = join(payloadDir, 'tmp')

  for (const dir of [nodeTarget, prefixTarget, binTarget, dataTarget, logsTarget, tempTarget]) {
    mkdirSync(dir, { recursive: true })
  }

  cpSync(nodeRoot, nodeTarget, { recursive: true, force: true })

  const nodeBinary = join(nodeTarget, 'bin', 'node')
  const npmCli = join(nodeTarget, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const npmEnv = {
    ...process.env,
    PATH: `${join(nodeTarget, 'bin')}:${process.env.PATH ?? ''}`,
    NPM_CONFIG_PREFIX: prefixTarget,
    NPM_CONFIG_CACHE: buildCacheDir,
    TMPDIR: buildTempDir,
    TEMP: buildTempDir,
    TMP: buildTempDir,
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  }

  if (!existsSync(nodeBinary)) {
    throw new Error(`Bundled node executable is missing at ${nodeBinary}`)
  }

  if (!existsSync(npmCli)) {
    throw new Error(`Bundled npm CLI is missing at ${npmCli}`)
  }

  let lastInstallError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    console.log(`Installing n8n into the Linux runtime artifact (attempt ${attempt}/3)...`)
    resetDirectory(prefixTarget)
    resetDirectory(buildTempDir)

    try {
      run(nodeBinary, [
        npmCli,
        'install',
        '-g',
        `n8n@${runtimeConfig.n8nVersion}`,
        '--prefer-offline',
        '--no-audit',
        '--no-fund',
      ], {
        cwd: payloadDir,
        env: npmEnv,
      })
      lastInstallError = null
      break
    } catch (error) {
      lastInstallError = error
      if (attempt === 3) {
        break
      }
      console.warn(`n8n install attempt ${attempt} failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (lastInstallError) {
    throw lastInstallError
  }

  const installedN8nPackage = join(prefixTarget, 'lib', 'node_modules', 'n8n', 'package.json')
  if (!existsSync(installedN8nPackage)) {
    throw new Error('n8n did not install into the staged Linux runtime.')
  }

  const launcherPath = join(binTarget, 'n8n')
  writeTextFile(launcherPath, [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'AUTOMATION_HOME="$(cd "$SCRIPT_DIR/.." && pwd)"',
    'export N8N_USER_FOLDER="$AUTOMATION_HOME/data"',
    'export TMPDIR="$AUTOMATION_HOME/tmp"',
    'export TEMP="$AUTOMATION_HOME/tmp"',
    'export TMP="$AUTOMATION_HOME/tmp"',
    'exec "$AUTOMATION_HOME/node/bin/node" "$AUTOMATION_HOME/prefix/lib/node_modules/n8n/bin/n8n" "$@"',
    '',
  ].join('\n'))
  run('chmod', ['+x', launcherPath])

  writeJsonFile(join(payloadDir, 'manifest.json'), {
    runtimeVersion: runtimeConfig.runtimeVersion,
    platform: runtimeConfig.platform,
    nodeVersion: runtimeConfig.nodeVersion,
    n8nVersion: runtimeConfig.n8nVersion,
    gitVersion: runtimeConfig.gitVersion,
    paths: {
      node: 'node/bin/node',
      git: null,
      n8nCli: 'prefix/lib/node_modules/n8n/bin/n8n',
      launcher: 'bin/n8n',
    },
  })

  rmSync(assetPath, { force: true })
  rmSync(checksumPath, { force: true })
  run('tar', ['-czf', assetPath, '-C', payloadDir, '.'])
  await writeChecksumFile(assetPath, checksumPath)
  writeJsonFile(stateFile, getBundleState())

  console.log(`Prepared Linux runtime artifact at ${assetPath}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
