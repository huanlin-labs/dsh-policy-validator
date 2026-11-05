import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(path))
    else if (/\.(js|mjs)$/.test(entry.name)) out.push(path)
  }
  return out
}

const files = ['src', 'scripts', 'test']
  .flatMap(name => walk(join(root, name)))
  .filter(file => !file.endsWith('compat.test.js'))

/** Node 20 is the declared floor; these APIs landed later. */
const FORBIDDEN = [
  '.toSorted(',
  '.toReversed(',
  'Object.groupBy',
  'Map.groupBy',
  'Promise.withResolvers',
  'Array.fromAsync',
  'import.meta.dirname',
  'process.getBuiltinModule',
  'RegExp.escape',
]

test('source stays within the Node 20 API surface', () => {
  const offenders = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const pattern of FORBIDDEN) if (text.includes(pattern)) offenders.push(`${relative(root, file)}: ${pattern}`)
  }
  assert.deepEqual(offenders, [], `Node 20 compatibility offenders: ${offenders.join(', ')}`)
})
