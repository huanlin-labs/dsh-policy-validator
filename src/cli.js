#!/usr/bin/env node
/**
 * CLI entry point. No dependencies, no network, no service.
 *
 *   check   --settings <file> [--deployment <file>] [--format text|json] [--strict] [--max-warnings N]
 *   matrix  --settings <file> [--format text|json]
 *   version --settings <file> [--compare <file>] [--expect <hash>]
 *   rules   [--format text|json]
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { POLICY_REVISION } from './model.js'
import { CATALOG } from './catalog.js'
import { validate } from './index.js'
import { admissionMatrix, renderMatrixText, LISTED_ADDRESSED_RULE } from './matrix.js'
import { policyVersion, comparePolicies } from './version.js'
import { renderText, exitCodeOf } from './report.js'

const USAGE = `dsh-superagent policy validator — offline pre-flight for a Policy and its deployment config

Usage:
  policy-validator check   --settings <settings.json> [--deployment <config.json>] [--format text|json] [--strict] [--max-warnings N]
  policy-validator matrix  --settings <settings.json> [--format text|json]
  policy-validator version --settings <settings.json> [--compare <other.json>] [--expect <hash>]
  policy-validator rules   [--format text|json]

Exit codes: 0 = no error, 1 = findings or expectation mismatch, 2 = usage or file error.
`
const BOOLEAN_FLAGS = new Set(['strict', 'help'])
const VALUE_FLAGS = new Set(['settings', 'deployment', 'format', 'max-warnings', 'compare', 'expect'])
const ALLOWED_FLAGS = new Set([...BOOLEAN_FLAGS, ...VALUE_FLAGS])

function parseArgs(argv) {
  const flags = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (!arg.startsWith('--')) throw new Error(`unexpected argument "${arg}"`)
    const body = arg.slice(2)
    const eq = body.indexOf('=')
    const name = eq === -1 ? body : body.slice(0, eq)
    if (!ALLOWED_FLAGS.has(name)) throw new Error(`unknown option "--${name}"`)
    if (eq !== -1) {
      flags[name] = body.slice(eq + 1)
      continue
    }
    if (BOOLEAN_FLAGS.has(name)) {
      flags[name] = true
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) throw new Error(`--${name} needs a value`)
    flags[name] = next
    i += 1
  }
  return flags
}

function readJson(path, label) {
  const full = resolve(path)
  let text
  try {
    text = readFileSync(full, 'utf8')
  } catch (error) {
    throw new Error(`cannot read ${label} "${path}": ${error.message}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} "${path}" is not valid JSON: ${error.message}`)
  }
}

const formatOf = flags => {
  const format = flags.format ?? 'text'
  if (!['text', 'json'].includes(format)) throw new Error(`--format must be text or json (got "${format}")`)
  return format
}

function printReport(report, format) {
  if (format === 'json') process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  else process.stdout.write(renderText(report) + '\n')
}

function cmdCheck(flags) {
  if (!flags.settings) throw new Error('check requires --settings <file>')
  const format = formatOf(flags)
  const settings = readJson(flags.settings, 'settings')
  const deployment = flags.deployment ? readJson(flags.deployment, 'deployment') : undefined
  const maxWarnings = flags['max-warnings'] === undefined ? undefined : Number(flags['max-warnings'])
  if (maxWarnings !== undefined && (!Number.isInteger(maxWarnings) || maxWarnings < 0)) throw new Error('--max-warnings must be a non-negative integer')
  const report = validate(settings, deployment, {
    settingsPath: flags.settings,
    deploymentPath: flags.deployment ?? null,
    strict: flags.strict === true,
    maxWarnings,
  })
  printReport(report, format)
  if (flags.expect && flags.expect !== report.policyVersion) {
    process.stderr.write(`policy version mismatch: expected ${flags.expect}, got ${report.policyVersion}\n`)
    return 1
  }
  return exitCodeOf(report)
}

function cmdMatrix(flags) {
  if (!flags.settings) throw new Error('matrix requires --settings <file>')
  const format = formatOf(flags)
  const settings = readJson(flags.settings, 'settings')
  const matrix = admissionMatrix(settings)
  if (format === 'json') {
    process.stdout.write(JSON.stringify({ revision: POLICY_REVISION, rule: LISTED_ADDRESSED_RULE, sources: matrix }, null, 2) + '\n')
  } else {
    process.stdout.write(renderMatrixText(matrix) + '\n')
  }
  return 0
}

function cmdVersion(flags) {
  if (!flags.settings) throw new Error('version requires --settings <file>')
  const format = formatOf(flags)
  const settings = readJson(flags.settings, 'settings')
  if (flags.compare) {
    const other = readJson(flags.compare, 'comparison settings')
    const result = comparePolicies(settings, other)
    if (format === 'json') process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    else {
      const lines = [
        `before: ${result.versionBefore}`,
        `after:  ${result.versionAfter}`,
        `changed: ${result.changed}`,
        ...result.changes.map(change => `  ${change.area} ${change.kind} ${change.id ?? change.source ?? `${change.from} -> ${change.to}`}`),
        ...result.impacts.map(impact => `  impact ${impact.code}: ${impact.message}`),
      ]
      process.stdout.write(lines.join('\n') + '\n')
    }
    return 0
  }
  const version = policyVersion(settings)
  if (format === 'json') process.stdout.write(JSON.stringify({ revision: POLICY_REVISION, policyVersion: version }, null, 2) + '\n')
  else process.stdout.write(`${POLICY_REVISION} ${version}\n`)
  if (flags.expect && flags.expect !== version) {
    process.stderr.write(`policy version mismatch: expected ${flags.expect}, got ${version}\n`)
    return 1
  }
  return 0
}

function cmdRules(flags) {
  const format = formatOf(flags)
  if (format === 'json') process.stdout.write(JSON.stringify({ rules: CATALOG }, null, 2) + '\n')
  else {
    const lines = CATALOG.map(item => `${item.code}\t${item.severity}\t${item.category}\t${item.title}`)
    process.stdout.write(lines.join('\n') + '\n')
  }
  return 0
}

function main(argv) {
  const command = argv[0]
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    process.stdout.write(USAGE)
    return command ? 0 : 2
  }
  const flags = parseArgs(argv.slice(1))
  if (flags.help) {
    process.stdout.write(USAGE)
    return 0
  }
  switch (command) {
    case 'check': return cmdCheck(flags)
    case 'matrix': return cmdMatrix(flags)
    case 'version': return cmdVersion(flags)
    case 'rules': return cmdRules(flags)
    default: throw new Error(`unknown command "${command}" (expected check, matrix, version or rules)`)
  }
}

try {
  process.exitCode = main(process.argv.slice(2))
} catch (error) {
  process.stderr.write(`error: ${error.message}\n`)
  process.exitCode = 2
}
