/**
 * One-off generator for fixtures/cases/*.
 * Kept in the repo so the corpus can be rebuilt after a snapshot update:
 *   node scripts/gen-fixtures.mjs
 * The expected codes are curated by hand; `node scripts/check-fixtures.mjs`
 * verifies they still match the validator.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOG_BY_CODE } from '../src/catalog.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'fixtures', 'cases')

const baseSettings = {
  paused: false,
  policy: { rules: [], sources: {} },
  eval: { mode: 'observe', timeoutSeconds: 120, model: null },
  executor: { model: null, maxWorkers: 3, directory: '', prepare: '', blockedCommands: [] },
  sources: {},
}
const baseDeployment = {
  stateDir: '/srv/dsh-superagent',
  promptMaxChars: 100000,
  admissionContextMaxPages: 10,
  admissionContextTimeoutMs: 15000,
  github: { repository: 'owner/name', cli: 'gh' },
}
const noGithubDeployment = {
  stateDir: '/srv/dsh-superagent',
  promptMaxChars: 100000,
  admissionContextMaxPages: 10,
  admissionContextTimeoutMs: 15000,
}

const cases = []
const add = (name, settings, deployment, expected) =>
  cases.push({ name, settings, deployment, expected })

const validFullSettings = {
  paused: false,
  policy: {
    rules: [
      { id: 'copy', name: 'Copy fixes', enabled: true, instruction: 'Fix typos and punctuation without changing meaning.' },
      { id: 'visual', name: 'Visual fixes', enabled: true, instruction: 'Fix local spacing or alignment with a specified target.' },
    ],
    sources: {
      github: {
        allowed: [{ id: 'alice', name: 'Alice' }],
        admission: { issue: { listedUnaddressed: 'inferred' }, pull_request: { listedUnaddressed: 'inferred' } },
        bots: [{ id: 'dependabot[bot]', name: 'Dependabot' }],
      },
    },
  },
  eval: { mode: 'auto', timeoutSeconds: 120, model: null },
  executor: { model: null, maxWorkers: 3, directory: '', prepare: 'pnpm install --frozen-lockfile', blockedCommands: ['npm'] },
  sources: { github: { enabled: true, config: { receiveAll: true } } },
}
const validFullDeployment = { ...baseDeployment, github: { repository: 'deepseek-ai/dsh-superagent-prototype', cli: 'gh' } }

add('01-valid-empty', {}, baseDeployment, [])
add('02-valid-full', validFullSettings, validFullDeployment, [])
add('03-valid-default-rules', { ...baseSettings, eval: { mode: 'observe' }, policy: { sources: {} } }, baseDeployment, [])

add('04-dep-all-invalid', { ...baseSettings }, {
  stateDir: 'C:/dsh',
  promptMaxChars: 10,
  admissionContextMaxPages: 0,
  admissionContextTimeoutMs: 99999,
  worktreeRoot: 'old',
  github: { repository: 'bad', cli: '', branchPrefix: 'x' },
  feishu: { clii: 'x' },
}, ['DEP001', 'DEP002', 'DEP003', 'DEP004', 'DEP005', 'DEP006', 'DEP007', 'DEP008', 'DEP009'])

add('05-dep-not-object', { ...baseSettings }, 42, ['DEP000'])
add('06-dep-valid-no-github', { ...baseSettings }, baseDeployment, [])

add('07-policy-all-invalid', {
  ...baseSettings,
  policy: {
    rules: [
      { id: 'bad id', name: '', enabled: 'yes', instruction: '', extra: 1 },
      { id: 'dup', name: 'Dup', enabled: true, instruction: 'x' },
      { id: 'dup', name: 'Dup2', enabled: true, instruction: 'y' },
    ],
    sources: {},
  },
}, baseDeployment, ['POL002', 'POL003', 'POL004', 'POL005', 'POL006', 'POL007'])

add('08-policy-not-object', { ...baseSettings, policy: 'x' }, baseDeployment, ['POL000'])
add('09-rules-not-array', { ...baseSettings, policy: { rules: {}, sources: {} } }, baseDeployment, ['POL001'])

add('10-sources-all-invalid', {
  ...baseSettings,
  policy: {
    rules: [],
    sources: {
      Bad: { allowed: [{}], admission: { r: { unlistedAddresed: 'ignore' } }, bots: ['x'], allowedSync: 1 },
      github: { allowed: [{ id: 'a' }, { id: 'A' }], admission: [] },
    },
  },
  sources: { Bad: { enabled: true, config: {} }, github: { enabled: true, config: {} } },
}, baseDeployment, ['SRC001', 'SRC002', 'SRC003', 'SRC004', 'SRC006', 'SRC007', 'SRC008'])

add('11-admission-value', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issue: { listedUnaddressed: 'explicit' } } } } },
  sources: { github: { enabled: true, config: {} } },
}, baseDeployment, ['SRC005'])

add('12-sources-not-object', { ...baseSettings, policy: { rules: [], sources: [] } }, baseDeployment, ['SRC000'])

add('13-eval-all-invalid', {
  ...baseSettings,
  eval: { mode: 'sometimes', timeoutSeconds: 5, model: { provider: '' }, retries: 1 },
}, baseDeployment, ['EVAL001', 'EVAL002', 'EVAL003', 'EVAL004'])

add('14-eval-not-object', { ...baseSettings, eval: 1 }, baseDeployment, ['EVAL000'])

add('15-executor-all-invalid', {
  ...baseSettings,
  executor: {
    maxWorkers: 99,
    directory: 'C:/x',
    prepare: 'x'.repeat(4001),
    blockedCommands: ['a b', 'npm', 'npm'],
    model: { provider: 'x' },
    shell: 'bash',
  },
}, baseDeployment, ['EXE001', 'EXE002', 'EXE003', 'EXE004', 'EXE005', 'EXE006', 'EXE007'])

add('16-executor-not-object', { ...baseSettings, executor: [] }, baseDeployment, ['EXE000'])

add('17-cross-all', {
  ...baseSettings,
  nope: 1,
  paused: 'no',
  sources: { github: { enabled: 'yes', config: 1 } },
}, baseDeployment, ['X001', 'X002', 'X003'])

add('18-settings-not-object', 42, baseDeployment, ['X000'])

add('19-sem-mode-off', { ...baseSettings, eval: { mode: 'off' }, policy: { sources: {} } }, baseDeployment, ['SEM001'])
add('20-sem-auto-no-rules', { ...baseSettings, eval: { mode: 'auto' } }, baseDeployment, ['SEM002'])
add('21-sem-explicit', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issue: { unlistedAddressed: 'explicit' } } } } },
  sources: { github: { enabled: true, config: {} } },
}, baseDeployment, ['SEM003'])
add('22-sem-scope', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issue: { listedUnaddressed: 'inferred' } } } } },
  sources: { github: { enabled: true, config: { receiveAll: false } } },
}, baseDeployment, ['SEM004'])
add('23-sem-worker-command', { ...baseSettings, executor: { blockedCommands: ['gh'] } }, baseDeployment, ['SEM005'])
add('24-sem-paused', { ...baseSettings, paused: true }, baseDeployment, ['SEM006'])
add('25-sem-no-instance', { ...baseSettings, policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }] } } } }, baseDeployment, ['SEM007'])
add('26-sem-allowed-empty', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [], admission: { issue: { listedUnaddressed: 'inferred' } } } } },
  sources: { github: { enabled: true, config: {} } },
}, baseDeployment, ['SEM008'])
add('27-sem-duplicate-name', {
  ...baseSettings,
  policy: { rules: [
    { id: 'a', name: 'Fix', enabled: true, instruction: 'x' },
    { id: 'b', name: 'fix', enabled: true, instruction: 'y' },
  ], sources: {} },
}, baseDeployment, ['SEM009'])
add('28-sem-all-disabled', {
  ...baseSettings,
  policy: { rules: [{ id: 'a', name: 'A', enabled: false, instruction: 'x' }], sources: {} },
}, baseDeployment, ['SEM010'])

add('29-cross-github-without-deployment', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }] } } },
  sources: { github: { enabled: true, config: {} } },
}, { stateDir: '/srv/dsh-superagent', promptMaxChars: 100000, admissionContextMaxPages: 10, admissionContextTimeoutMs: 15000 }, ['X004'])
add('30-cross-feishu-without-deployment', {
  ...baseSettings,
  policy: { rules: [], sources: { feishu: { allowed: [{ id: 'ou_a' }] } } },
  sources: { feishu: { enabled: true, config: {} } },
}, baseDeployment, ['X005'])

add('31-valid-auto', validFullSettings, validFullDeployment, [])
add('32-combined-risky', {
  paused: true,
  policy: { rules: [{ id: 'copy', name: 'Copy fixes', enabled: true, instruction: 'Fix typos.' }], sources: {
    github: { allowed: [{ id: 'alice' }], admission: { issue: { unlistedAddressed: 'explicit' } } },
  } },
  eval: { mode: 'off' },
  executor: { blockedCommands: ['gh'] },
  sources: { github: { enabled: true, config: {} } },
}, validFullDeployment, ['SEM001', 'SEM003', 'SEM005', 'SEM006'])

add('33-sem-duplicate-allowed', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'alice' }, { id: 'Alice' }] } } },
  sources: { github: { enabled: true, config: {} } },
}, baseDeployment, ['SRC003'])
add('34-sem-unknown-source-key', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], autoSync: true } } },
  sources: { github: { enabled: true, config: {} } },
}, baseDeployment, ['SRC008'])

mkdirSync(root, { recursive: true })
for (const item of cases) {
  const dir = join(root, item.name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(item.settings, null, 2) + '\n')
  writeFileSync(join(dir, 'deployment.json'), JSON.stringify(item.deployment, null, 2) + '\n')
  const failed = item.expected.some(code => CATALOG_BY_CODE.get(code)?.severity === 'error')
  writeFileSync(join(dir, 'expected.json'), JSON.stringify({ exitCode: failed ? 1 : 0, codes: item.expected }, null, 2) + '\n')
}
console.log(`wrote ${cases.length} cases to ${root}`)

