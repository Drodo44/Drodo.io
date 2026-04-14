import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const packageJsonPath = join(repoRoot, 'package.json')
const tauriConfigPath = join(repoRoot, 'src-tauri', 'tauri.conf.json')
const cargoTomlPath = join(repoRoot, 'src-tauri', 'Cargo.toml')
const cargoLockPath = join(repoRoot, 'src-tauri', 'Cargo.lock')

const VERSION_PATTERN = /^\d+\.\d+\.\d+$/

function readText(path) {
  return readFileSync(path, 'utf8')
}

function writeText(path, value) {
  writeFileSync(path, value, 'utf8')
}

function readPackageJson() {
  return JSON.parse(readText(packageJsonPath))
}

function writePackageJson(nextVersion) {
  const packageJson = readPackageJson()
  packageJson.version = nextVersion
  writeText(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
}

function readTauriConfig() {
  return JSON.parse(readText(tauriConfigPath))
}

function writeTauriConfig(nextVersion) {
  const tauriConfig = readTauriConfig()
  tauriConfig.version = nextVersion
  writeText(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`)
}

function readCargoTomlVersion() {
  const cargoToml = readText(cargoTomlPath)
  const match = cargoToml.match(/(\[package\][\s\S]*?^version = )"([^"]+)"/m)
  if (!match) {
    throw new Error(`Could not find package version in ${cargoTomlPath}`)
  }
  return match[2]
}

function writeCargoTomlVersion(nextVersion) {
  const cargoToml = readText(cargoTomlPath)
  const nextCargoToml = cargoToml.replace(
    /(\[package\][\s\S]*?^version = )"([^"]+)"/m,
    `$1"${nextVersion}"`,
  )

  if (nextCargoToml === cargoToml) {
    throw new Error(`Failed to update package version in ${cargoTomlPath}`)
  }

  writeText(cargoTomlPath, nextCargoToml)
}

function detectLineEnding(value) {
  return value.includes('\r\n') ? '\r\n' : '\n'
}

function readCargoLockVersion() {
  const cargoLock = readText(cargoLockPath)
  const match = cargoLock.match(/\[\[package\]\]\r?\nname = "tauri-app"\r?\nversion = "([^"]+)"/)
  if (!match) {
    throw new Error(`Could not find tauri-app package version in ${cargoLockPath}`)
  }
  return match[1]
}

function writeCargoLockVersion(nextVersion) {
  const cargoLock = readText(cargoLockPath)
  const eol = detectLineEnding(cargoLock)
  const nextCargoLock = cargoLock.replace(
    /\[\[package\]\]\r?\nname = "tauri-app"\r?\nversion = "[^"]+"/,
    `[[package]]${eol}name = "tauri-app"${eol}version = "${nextVersion}"`,
  )

  if (nextCargoLock === cargoLock) {
    throw new Error(`Failed to update tauri-app package version in ${cargoLockPath}`)
  }

  writeText(cargoLockPath, nextCargoLock)
}

function getVersions() {
  return {
    packageJson: readPackageJson().version,
    tauriConfig: readTauriConfig().version,
    cargoToml: readCargoTomlVersion(),
    cargoLock: readCargoLockVersion(),
  }
}

function ensureVersionsMatch() {
  const versions = getVersions()
  const uniqueVersions = [...new Set(Object.values(versions))]
  if (uniqueVersions.length !== 1) {
    throw new Error(
      `Version mismatch detected: package.json=${versions.packageJson}, `
      + `tauri.conf.json=${versions.tauriConfig}, Cargo.toml=${versions.cargoToml}, Cargo.lock=${versions.cargoLock}`,
    )
  }
  return uniqueVersions[0]
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status ?? 'unknown'}`)
  }
}

function setVersion(nextVersion, shouldTag) {
  if (!VERSION_PATTERN.test(nextVersion)) {
    throw new Error(`Invalid version "${nextVersion}". Expected semantic version like 1.2.35`)
  }

  writePackageJson(nextVersion)
  writeTauriConfig(nextVersion)
  writeCargoTomlVersion(nextVersion)
  writeCargoLockVersion(nextVersion)

  const finalVersion = ensureVersionsMatch()
  console.log(`Updated manifest versions to ${finalVersion}`)

  if (shouldTag) {
    run('git', ['tag', `v${finalVersion}`])
    console.log(`Created tag v${finalVersion}`)
  }
}

function verifyVersion(tagOverride) {
  const version = ensureVersionsMatch()
  const expectedTag = tagOverride || process.env.CIRCLE_TAG || ''

  if (expectedTag && expectedTag !== `v${version}`) {
    throw new Error(`Tag ${expectedTag} does not match manifest version ${version}`)
  }

  console.log(`Version check passed: ${version}${expectedTag ? ` (${expectedTag})` : ''}`)
}

function main() {
  const [command, versionArg, ...restArgs] = process.argv.slice(2)
  const shouldTag = restArgs.includes('--tag')

  if (command === 'set') {
    if (!versionArg) {
      throw new Error('Usage: node scripts/release-version.mjs set <version> [--tag]')
    }
    setVersion(versionArg, shouldTag)
    return
  }

  if (command === 'verify') {
    verifyVersion(versionArg)
    return
  }

  throw new Error('Usage: node scripts/release-version.mjs <set|verify> [version] [--tag]')
}

main()
