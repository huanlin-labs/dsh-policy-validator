/** Verify every fixture against the curated expected codes. */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validate } from '../src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'fixtures', 'cases')
let failed = 0
const names = readdirSync(root, { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name).sort()
for (const name of names) {
  const dir = join(root, name)
  const settings = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8'))
  const deployment = JSON.parse(readFileSync(join(dir, 'deployment.json'), 'utf8'))
  const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'))
  const report = validate(settings, deployment)
  const actual = [...new Set(report.diagnostics.map(item => item.code))].sort()
  const wanted = [...new Set(expected.codes)].sort()
  const exitMatches = (expected.exitCode === 0) === report.ok
  if (JSON.stringify(actual) !== JSON.stringify(wanted) || !exitMatches) {
    failed += 1
    console.log(`FAIL ${name}`)
    console.log(`  expected: ${wanted.join(',') || '(none)'}  exit=${expected.exitCode}`)
    console.log(`  actual:   ${actual.join(',') || '(none)'}  ok=${report.ok}`)
  }
}
console.log(`${names.length - failed}/${names.length} fixtures match`)
process.exitCode = failed ? 1 : 0
