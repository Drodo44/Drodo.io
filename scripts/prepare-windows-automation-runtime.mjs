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
const assetBaseName = `drodo-runtime-windows-x64-${appVersion}.zip`
const assetPath = join(artifactDir, assetBaseName)
const checksumPath = `${assetPath}.sha256`
const cacheDir = join(repoRoot, '.cache', 'automation-runtime', 'windows')
const downloadsDir = join(cacheDir, 'downloads')
const workDir = join(cacheDir, 'work')
const buildCacheDir = join(cacheDir, 'npm-cache')
const buildTempDir = join(cacheDir, 'tmp')
const stateFile = join(cacheDir, 'bundle-state.json')
const payloadDir = join(workDir, 'payload')
const nodeExtractDir = join(workDir, 'node-extract')
const gitExtractDir = join(workDir, 'git-extract')

const runtimeConfig = {
  runtimeVersion: appVersion,
  nodeVersion: '24.14.0',
  n8nVersion: '2.15.0',
  gitVersion: '2.53.0(2)',
  platform: 'windows-x64',
  nodeUrl: 'https://nodejs.org/dist/v24.14.0/node-v24.14.0-win-x64.zip',
  gitUrl: 'https://github.com/git-for-windows/git/releases/download/v2.53.0.windows.2/MinGit-2.53.0.2-64-bit.zip',
}

if (process.platform !== 'win32') {
  console.log('Skipping Windows runtime build on non-Windows host.')
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

function runPowerShell(script) {
  run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    script,
  ])
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
    console.log(`Windows runtime artifact is up to date at ${assetPath}`)
    return
  }

  resetDirectory(payloadDir)
  resetDirectory(nodeExtractDir)
  resetDirectory(gitExtractDir)

  const nodeArchive = join(downloadsDir, basename(runtimeConfig.nodeUrl))
  const gitArchive = join(downloadsDir, basename(runtimeConfig.gitUrl))

  await downloadFile(runtimeConfig.nodeUrl, nodeArchive)
  await downloadFile(runtimeConfig.gitUrl, gitArchive)

  runPowerShell(`Expand-Archive -LiteralPath '${nodeArchive.replace(/'/g, "''")}' -DestinationPath '${nodeExtractDir.replace(/'/g, "''")}' -Force`)
  runPowerShell(`Expand-Archive -LiteralPath '${gitArchive.replace(/'/g, "''")}' -DestinationPath '${gitExtractDir.replace(/'/g, "''")}' -Force`)

  const nodeRoot = getSingleExtractedDirectory(nodeExtractDir)
  const nodeTarget = join(payloadDir, 'bin')
  const gitTarget = join(payloadDir, 'git')
  const prefixTarget = join(payloadDir, 'prefix')
  const dataTarget = join(payloadDir, 'data')
  const logsTarget = join(payloadDir, 'logs')
  const tempTarget = join(payloadDir, 'tmp')

  for (const dir of [nodeTarget, gitTarget, prefixTarget, dataTarget, logsTarget, tempTarget]) {
    mkdirSync(dir, { recursive: true })
  }

  cpSync(nodeRoot, nodeTarget, { recursive: true, force: true })
  cpSync(gitExtractDir, gitTarget, { recursive: true, force: true })

  const nodeExe = join(nodeTarget, 'node.exe')
  const npmCli = join(nodeTarget, 'node_modules', 'npm', 'bin', 'npm-cli.js')
  const npmEnv = {
    ...process.env,
    PATH: `${nodeTarget};${process.env.PATH ?? ''}`,
    NPM_CONFIG_PREFIX: prefixTarget,
    NPM_CONFIG_CACHE: buildCacheDir,
    TEMP: buildTempDir,
    TMP: buildTempDir,
    npm_config_update_notifier: 'false',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
  }

  if (!existsSync(nodeExe)) {
    throw new Error(`Bundled node executable is missing at ${nodeExe}`)
  }

  if (!existsSync(npmCli)) {
    throw new Error(`Bundled npm CLI is missing at ${npmCli}`)
  }

  let lastInstallError = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    console.log(`Installing n8n into the Windows runtime artifact (attempt ${attempt}/3)...`)
    resetDirectory(prefixTarget)
    resetDirectory(buildTempDir)

    try {
      run(nodeExe, [
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

  const installedN8nPackage = join(prefixTarget, 'node_modules', 'n8n', 'package.json')
  if (!existsSync(installedN8nPackage)) {
    throw new Error('n8n did not install into the staged Windows runtime.')
  }

  writeTextFile(join(nodeTarget, 'n8n.cmd'), [
    '@ECHO OFF',
    'SETLOCAL',
    'SET "SCRIPT_DIR=%~dp0"',
    'SET "AUTOMATION_HOME=%SCRIPT_DIR%.."',
    'SET "N8N_USER_FOLDER=%AUTOMATION_HOME%\\data"',
    'SET "TEMP=%AUTOMATION_HOME%\\tmp"',
    'SET "TMP=%AUTOMATION_HOME%\\tmp"',
    'SET "PATH=%SCRIPT_DIR%;%AUTOMATION_HOME%\\git\\cmd;%AUTOMATION_HOME%\\git\\mingw64\\bin;%PATH%"',
    '"%SCRIPT_DIR%node.exe" "%AUTOMATION_HOME%\\prefix\\node_modules\\n8n\\bin\\n8n" %*',
    'ENDLOCAL',
    '',
  ].join('\r\n'))

  writeJsonFile(join(payloadDir, 'manifest.json'), {
    runtimeVersion: runtimeConfig.runtimeVersion,
    platform: runtimeConfig.platform,
    nodeVersion: runtimeConfig.nodeVersion,
    n8nVersion: runtimeConfig.n8nVersion,
    gitVersion: runtimeConfig.gitVersion,
    paths: {
      node: 'bin/node.exe',
      git: 'git/cmd/git.exe',
      n8nCli: 'prefix/node_modules/n8n/bin/n8n',
      launcher: 'bin/n8n.cmd',
    },
  })

  rmSync(assetPath, { force: true })
  rmSync(checksumPath, { force: true })
  run('tar.exe', [
    '--options',
    'zip:compression=deflate',
    '-a',
    '-cf',
    assetPath,
    '-C',
    payloadDir,
    '.',
  ])
  await writeChecksumFile(assetPath, checksumPath)
  writeJsonFile(stateFile, getBundleState())

  console.log(`Prepared Windows runtime artifact at ${assetPath}`)
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
