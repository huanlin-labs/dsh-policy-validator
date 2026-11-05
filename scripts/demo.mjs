/** One-command demo: valid, invalid, matrix, version compare. */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { CATALOG } from '../src/catalog.js'

const here = dirname(fileURLToPath(import.meta.url))
const project = join(here, '..')
const cli = join(project, 'src', 'cli.js')
const run = (title, args, expected) => {
  process.stdout.write(`\n=== ${title} ===\n`)
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: project, stdio: 'inherit' })
  if (result.status !== expected) {
    process.stderr.write(`\ndemo failed: expected exit ${expected}, got ${result.status}\n`)
    process.exit(1)
  }
}

run('1. valid config — exits 0', ['check', '--settings', 'examples/valid/settings.json', '--deployment', 'examples/valid/deployment.json'], 0)
run('2. invalid config — exits 1', ['check', '--settings', 'examples/invalid/settings.json', '--deployment', 'examples/invalid/deployment.json'], 1)
run('3. admission matrix — who gets in', ['matrix', '--settings', 'examples/valid/settings.json'], 0)
run('4. version compare — what a change costs', ['version', '--settings', 'examples/valid/settings.json', '--compare', 'examples/invalid/settings.json'], 0)

const bySeverity = CATALOG.reduce((acc, item) => ({ ...acc, [item.severity]: (acc[item.severity] ?? 0) + 1 }), {})
process.stdout.write(`\n=== 5. catalog ===\n`)
process.stdout.write(`${CATALOG.length} codes: ${bySeverity.error ?? 0} error, ${bySeverity.warning ?? 0} warning, ${bySeverity.info ?? 0} info\n`)
process.stdout.write('\ndemo complete.\n')
