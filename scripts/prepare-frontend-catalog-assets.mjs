import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const sourceRoot = join(repoRoot, 'src', 'data')
const outputRoot = join(repoRoot, 'public', 'catalog')

const skillsSourceDir = join(sourceRoot, 'skills')
const workflowsSourceDir = join(sourceRoot, 'workflows')

const skillsIndexPath = join(skillsSourceDir, 'skills-index.json')
const skillCategoriesPath = join(skillsSourceDir, 'skill-categories.json')
const skillsContentPath = join(skillsSourceDir, 'skills-content.json')
const workflowsIndexPath = join(workflowsSourceDir, 'workflows-index.json')
const workflowTemplatesSourceDir = join(workflowsSourceDir, 'workflow-templates')

const skillsOutputDir = join(outputRoot, 'skills')
const skillContentOutputDir = join(skillsOutputDir, 'content')
const workflowsOutputDir = join(outputRoot, 'workflows')
const workflowTemplatesOutputDir = join(workflowsOutputDir, 'workflow-templates')
const stateFile = join(outputRoot, '.catalog-state.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function getDirectoryMtimeMs(root) {
  let latest = 0
  const entries = readdirSync(root, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      latest = Math.max(latest, getDirectoryMtimeMs(fullPath))
      continue
    }
    latest = Math.max(latest, statSync(fullPath).mtimeMs)
  }

  return latest
}

function getCatalogState() {
  return {
    skillsIndexMtimeMs: statSync(skillsIndexPath).mtimeMs,
    skillCategoriesMtimeMs: statSync(skillCategoriesPath).mtimeMs,
    skillsContentMtimeMs: statSync(skillsContentPath).mtimeMs,
    workflowsIndexMtimeMs: statSync(workflowsIndexPath).mtimeMs,
    workflowTemplatesMtimeMs: getDirectoryMtimeMs(workflowTemplatesSourceDir),
  }
}

function isCurrent(nextState) {
  if (!existsSync(stateFile)) {
    return false
  }

  try {
    const currentState = readJson(stateFile)
    return Object.entries(nextState).every(([key, value]) => currentState[key] === value)
  } catch {
    return false
  }
}

function encodeContentFileName(id) {
  return `${encodeURIComponent(id)}.md`
}

function buildSkillsIndex(indexRecords) {
  return indexRecords.map(record => ({
    ...record,
    contentFile: `content/${encodeContentFileName(record.id)}`,
  }))
}

function writeSkillContentFiles(contentById) {
  rmSync(skillContentOutputDir, { recursive: true, force: true })
  ensureDir(skillContentOutputDir)

  for (const [id, content] of Object.entries(contentById)) {
    const fileName = encodeContentFileName(id)
    writeFileSync(join(skillContentOutputDir, fileName), content, 'utf8')
  }
}

function main() {
  const nextState = getCatalogState()
  if (isCurrent(nextState)) {
    console.log(`Frontend catalog assets are up to date at ${outputRoot}`)
    return
  }

  rmSync(outputRoot, { recursive: true, force: true })
  ensureDir(skillsOutputDir)
  ensureDir(workflowsOutputDir)

  const skillsIndex = readJson(skillsIndexPath)
  const skillCategories = readJson(skillCategoriesPath)
  const skillsContent = readJson(skillsContentPath)

  writeJson(join(skillsOutputDir, 'skills-index.json'), buildSkillsIndex(skillsIndex))
  writeJson(join(skillsOutputDir, 'skill-categories.json'), skillCategories)
  writeSkillContentFiles(skillsContent)

  cpSync(workflowsIndexPath, join(workflowsOutputDir, 'workflows-index.json'), { force: true })
  cpSync(workflowTemplatesSourceDir, workflowTemplatesOutputDir, { recursive: true, force: true })

  writeJson(stateFile, nextState)
  console.log(`Prepared frontend catalog assets at ${outputRoot}`)
}

main()
