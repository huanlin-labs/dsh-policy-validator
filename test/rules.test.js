import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validate, policyVersion, comparePolicies, admissionMatrix, CATALOG } from '../src/index.js'

const base = {
  policy: {
    rules: [{ id: 'copy', name: 'Copy fixes', enabled: true, instruction: 'Fix typos.' }],
    sources: {},
  },
  eval: { mode: 'auto' },
}

const codes = report => report.diagnostics.map(item => item.code)

test('catalog codes are unique and well formed', () => {
  const seen = new Set()
  for (const item of CATALOG) {
    assert.match(item.code, /^(DEP|POL|SRC|EVAL|EXE|X|SEM)\d{3}$/)
    assert.ok(['error', 'warning', 'info'].includes(item.severity))
    assert.ok(!seen.has(item.code), `duplicate catalog code ${item.code}`)
    seen.add(item.code)
  }
  assert.ok(CATALOG.length >= 40, `catalog has only ${CATALOG.length} codes`)
})

test('a valid full config has no findings', () => {
  const settings = {
    paused: false,
    policy: {
      rules: [{ id: 'copy', name: 'Copy fixes', enabled: true, instruction: 'Fix typos and punctuation.' }],
      sources: {
        github: {
          allowed: [{ id: 'alice', name: 'Alice' }],
          admission: { issues: { listedUnaddressed: 'inferred' } },
          bots: [{ id: 'dependabot[bot]' }],
        },
      },
    },
    eval: { mode: 'observe', timeoutSeconds: 120, model: null },
    executor: { maxWorkers: 3, directory: '', prepare: '', blockedCommands: ['npm'] },
    sources: { github: { enabled: true, config: { repository: 'a/b', cli: 'gh', observeIssues: true } } },
  }
  const deployment = { stateDir: '/srv/dsh' }
  const report = validate(settings, deployment)
  assert.deepEqual(codes(report), [])
  assert.equal(report.ok, true)
  assert.equal(report.summary.error, 0)
})

test('deployment stateDir must be absolute', () => {
  const report = validate(base, { stateDir: 'C:/x' })
  assert.ok(codes(report).includes('DEP001'))
  assert.equal(report.ok, false)
})

test('unknown deployment key reports where it moved', () => {
  const report = validate(base, { stateDir: '/srv', worktreeRoot: 'x' })
  const finding = report.diagnostics.find(item => item.code === 'DEP002')
  assert.ok(finding)
  assert.match(finding.message, /ticket directory/)
})

test('rule id regex matches upstream', () => {
  const report = validate({ ...base, policy: { ...base.policy, rules: [{ id: 'bad id', name: 'X', enabled: true, instruction: 'x' }] } })
  assert.ok(codes(report).includes('POL003'))
})

test('admission cell enum rejects explicit on an unaddressed cell', () => {
  const report = validate({
    ...base,
    policy: { ...base.policy, sources: { github: { allowed: [{ id: 'a' }], admission: { issue: { listedUnaddressed: 'explicit' } } } } },
    sources: { github: { enabled: true, config: {} } },
  })
  assert.ok(codes(report).includes('SRC005'))
})

test('eval mode enum', () => {
  const report = validate({ ...base, eval: { mode: 'sometimes' } })
  assert.ok(codes(report).includes('EVAL001'))
})

test('executor maxWorkers range', () => {
  const report = validate({ ...base, executor: { maxWorkers: 99 } })
  assert.ok(codes(report).includes('EXE001'))
})

test('open admission cell is reported as a security consequence', () => {
  const report = validate({
    ...base,
    policy: { ...base.policy, sources: { github: { allowed: [{ id: 'a' }], admission: { issue: { unlistedAddressed: 'explicit' } } } } },
    sources: { github: { enabled: true, config: {} } },
  })
  const finding = report.diagnostics.find(item => item.code === 'SEM003')
  assert.ok(finding)
  assert.match(finding.consequence, /allowed list stops protecting/)
})

test('worker command cannot be blocked', () => {
  const report = validate({ ...base, executor: { blockedCommands: ['gh'] } })
  const finding = report.diagnostics.find(item => item.code === 'SEM005')
  assert.ok(finding)
  assert.equal(finding.severity, 'error')
})

test('policyVersion is stable and ignores non-policy fields', () => {
  const a = policyVersion(base)
  assert.equal(a, policyVersion(base))
  assert.equal(a, policyVersion({ ...base, paused: true }))
  assert.equal(a, policyVersion({ ...base, executor: { maxWorkers: 16 } }))
})

test('policyVersion changes with rules, mode and sources', () => {
  const a = policyVersion(base)
  assert.notEqual(a, policyVersion({ ...base, eval: { mode: 'observe' } }))
  assert.notEqual(a, policyVersion({ ...base, policy: { ...base.policy, rules: [] } }))
  assert.notEqual(a, policyVersion({ ...base, policy: { ...base.policy, sources: { github: { allowed: [{ id: 'a' }] } } } }))
})

test('comparePolicies flags inferred mandates when auto is left', () => {
  const result = comparePolicies(base, { ...base, eval: { mode: 'observe' } })
  assert.equal(result.changed, true)
  assert.ok(result.impacts.some(item => item.code === 'INFERRED_MANDATES_LOSE_AUTO'))
})

test('admission matrix shows defaults and configured sources', () => {
  const matrix = admissionMatrix({ policy: { sources: { github: { allowed: [], admission: {} } } } })
  assert.equal(matrix.length, 1)
  const row = matrix[0].rows.find(item => item.row === '<default>')
  assert.ok(row)
  assert.equal(row.cells.listedUnaddressed.value, 'inferred')
  assert.equal(row.cells.listedUnaddressed.source, 'default')
  assert.equal(row.cells.unlistedAddressed.value, 'ignore')
})

test('admission matrix marks explicitly configured cells', () => {
  const matrix = admissionMatrix({
    policy: { sources: { github: { allowed: [], admission: { issues: { listedUnaddressed: 'ignore' } } } } },
    sources: { github: { enabled: true, config: { repository: 'a/b', cli: 'gh', observeIssues: true } } },
  })
  const row = matrix[0].rows.find(item => item.row === 'issues')
  assert.equal(row.cells.listedUnaddressed.value, 'ignore')
  assert.equal(row.cells.listedUnaddressed.source, 'config')
})
