import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate, CATALOG } from '../src/index.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'cases')
const names = readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name).sort()

const load = name => ({
  settings: JSON.parse(readFileSync(join(root, name, 'settings.json'), 'utf8')),
  deployment: JSON.parse(readFileSync(join(root, name, 'deployment.json'), 'utf8')),
  expected: JSON.parse(readFileSync(join(root, name, 'expected.json'), 'utf8')),
})

test('fixture corpus has at least 30 cases', () => {
  assert.ok(names.length >= 30, `only ${names.length} fixtures`)
})

for (const name of names) {
  test(`fixture ${name}`, () => {
    const { settings, deployment, expected } = load(name)
    const report = validate(settings, deployment)
    const actual = [...new Set(report.diagnostics.map(item => item.code))].sort()
    const wanted = [...new Set(expected.codes)].sort()
    assert.deepEqual(actual, wanted, `diagnostic codes differ for ${name}`)
    assert.equal(report.ok, expected.exitCode === 0, `exit expectation differs for ${name}`)
  })
}

test('every catalog code is exercised by at least one fixture', () => {
  const covered = new Set()
  for (const name of names) for (const code of load(name).expected.codes) covered.add(code)
  const missing = CATALOG.map(item => item.code).filter(code => !covered.has(code))
  assert.deepEqual(missing, [], `uncovered codes: ${missing.join(', ')}`)
})
