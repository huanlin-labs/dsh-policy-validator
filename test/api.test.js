import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validate,
  structureDiagnostics,
  semanticDiagnostics,
  buildReport,
  sortDiagnostics,
  renderText,
  canonicalPolicy,
  policyVersion,
  exitCodeOf,
} from '../src/index.js'

test('validate never throws on hostile non-object input', () => {
  for (const value of [null, undefined, 42, 'x', [], true]) {
    const report = validate(value)
    assert.equal(report.ok, false)
    assert.ok(report.diagnostics.some(item => item.code === 'X000'))
  }
})

test('a null Source Policy is a finding, not a crash', () => {
  const report = validate({ policy: { rules: [], sources: { github: null } }, sources: { github: { enabled: true, config: {} } } })
  assert.ok(report.diagnostics.some(item => item.code === 'SRC000'))
  assert.equal(report.ok, false)
})

test('structure and semantic diagnostics are importable separately', () => {
  assert.ok(Array.isArray(structureDiagnostics({})))
  assert.ok(Array.isArray(semanticDiagnostics({})))
})

test('sortDiagnostics is stable and deduplicates identical findings', () => {
  const item = { code: 'X001', severity: 'error', path: 'b', message: 'm' }
  const sorted = sortDiagnostics([{ ...item, path: 'a' }, item, item])
  assert.equal(sorted.length, 2)
  assert.deepEqual(sorted.map(entry => entry.path), ['a', 'b'])
})

test('buildReport carries the expectation result into ok', () => {
  const pass = buildReport([], { policyVersion: 'abc', expectVersion: 'abc' })
  assert.equal(pass.ok, true)
  assert.equal(pass.expectation.match, true)
  const fail = buildReport([], { policyVersion: 'abc', expectVersion: 'def' })
  assert.equal(fail.ok, false)
  assert.equal(fail.expectation.match, false)
  assert.equal(exitCodeOf(fail), 1)
})

test('canonicalPolicy trims rule and allowed fields like zod', () => {
  const canonical = canonicalPolicy({
    policy: {
      rules: [{ id: 'a', name: '  Fix  ', enabled: true, instruction: '  Do it.  ' }],
      sources: { github: { allowed: [{ id: '  alice  ', name: '  Alice  ' }] } },
    },
  })
  assert.equal(canonical.rules[0].name, 'Fix')
  assert.equal(canonical.rules[0].instruction, 'Do it.')
  assert.equal(canonical.sources.github.allowed[0].id, 'alice')
})

test('renderText includes the policy version and every finding', () => {
  const report = buildReport([{ code: 'X001', severity: 'error', path: 'nope', message: 'bad' }], { policyVersion: 'abc' })
  const text = renderText(report)
  assert.match(text, /policy version: abc/)
  assert.match(text, /X001 nope/)
})

test('policyVersion is independent of deployment and role models', () => {
  const base = { policy: { rules: [], sources: {} } }
  assert.equal(policyVersion(base), policyVersion({ ...base, executor: { maxWorkers: 9 } }))
})
