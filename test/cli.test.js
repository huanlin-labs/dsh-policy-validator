import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const project = join(dirname(fileURLToPath(import.meta.url)), '..')
const cli = join(project, 'src', 'cli.js')
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: 'utf8' })

test('--help lists the four subcommands and exits 0', () => {
  const result = run('--help')
  assert.equal(result.status, 0)
  for (const word of ['check', 'matrix', 'version', 'rules']) assert.match(result.stdout, new RegExp(word))
})

test('no command prints usage to stderr and exits 2', () => {
  const result = run()
  assert.equal(result.status, 2)
  assert.match(result.stderr, /Usage:/)
  assert.equal(result.stdout, '')
})

test('check on the valid example exits 0', () => {
  const result = run('check', '--settings', 'examples/valid/settings.json', '--deployment', 'examples/valid/deployment.json')
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /OK — no findings/)
})

test('check --format json emits parseable JSON only', () => {
  const result = run('check', '--settings', 'fixtures/cases/04-dep-all-invalid/settings.json', '--deployment', 'fixtures/cases/04-dep-all-invalid/deployment.json', '--format', 'json')
  assert.equal(result.status, 1)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.equal(report.tool, 'dsh-superagent-policy-validator')
  assert.ok(report.summary.error > 0)
  assert.ok(Array.isArray(report.diagnostics))
  for (const key of ['code', 'severity', 'path', 'message', 'hint', 'source']) assert.ok(key in report.diagnostics[0])
})

test('missing settings file exits 2 with one readable reason', () => {
  const result = run('check', '--settings', 'does-not-exist.json')
  assert.equal(result.status, 2)
  assert.match(result.stderr, /^error: cannot read settings/)
})

test('--strict turns a warning-only fixture into exit 1', () => {
  const result = run('check', '--settings', 'fixtures/cases/44-sem-duplicate-allowed/settings.json', '--deployment', 'fixtures/cases/44-sem-duplicate-allowed/deployment.json', '--strict')
  assert.equal(result.status, 1)
})

test('matrix --format json is parseable and carries the invariant note', () => {
  const result = run('matrix', '--settings', 'examples/valid/settings.json', '--format', 'json')
  assert.equal(result.status, 0)
  const data = JSON.parse(result.stdout)
  assert.equal(data.revision, 'mandate-v3')
  assert.match(data.rule, /always explicit/)
  assert.ok(Array.isArray(data.sources))
})

test('version --format json returns the revision and a 32-char hash', () => {
  const result = run('version', '--settings', 'examples/valid/settings.json', '--format', 'json')
  assert.equal(result.status, 0)
  const data = JSON.parse(result.stdout)
  assert.equal(data.revision, 'mandate-v3')
  assert.match(data.policyVersion, /^[0-9a-f]{32}$/)
})

test('version --expect mismatch exits 1', () => {
  const result = run('version', '--settings', 'examples/valid/settings.json', '--expect', '00000000000000000000000000000000')
  assert.equal(result.status, 1)
})

test('rules --format json lists the catalog', () => {
  const result = run('rules', '--format', 'json')
  assert.equal(result.status, 0)
  const data = JSON.parse(result.stdout)
  assert.ok(data.rules.length >= 40)
  assert.ok(data.rules.every(item => item.code && item.severity && item.category && item.title))
})

test('unknown option exits 2', () => {
  const result = run('check', '--settings', 'examples/valid/settings.json', '--nope', 'x')
  assert.equal(result.status, 2)
  assert.match(result.stderr, /unknown|error/i)
})

test('demo runs all sections and exits 0', () => {
  const result = spawnSync(process.execPath, ['scripts/demo.mjs'], { cwd: project, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /valid config/)
  assert.match(result.stdout, /invalid config/)
  assert.match(result.stdout, /admission matrix/)
  assert.match(result.stdout, /version compare/)
  assert.match(result.stdout, /demo complete/)
})
