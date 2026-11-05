/**
 * Rebuild fixtures/cases/* from this script.
 *
 *   node scripts/gen-fixtures.mjs
 *
 * The expected code sets are curated here; `node scripts/check-fixtures.mjs`
 * compares the validator output against `expected.json`. After a snapshot
 * change, rebuild and re-check the intent of each case by hand.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOG_BY_CODE } from '../src/catalog.js'
import { validate } from '../src/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'fixtures', 'cases')

const github = (config = {}) => ({ enabled: true, config: { repository: 'owner/name', cli: 'gh', ...config } })
const baseSettings = {
  paused: false,
  policy: { rules: [], sources: {} },
  eval: { mode: 'observe', timeoutSeconds: 120, model: null },
  executor: { model: null, maxWorkers: 3, directory: '', prepare: '', blockedCommands: [] },
  sources: { github: github() },
}
const baseDeployment = {
  stateDir: '/srv/dsh-superagent',
  promptMaxChars: 100000,
  admissionContextMaxPages: 10,
  admissionContextTimeoutMs: 15000,
}
const rule = (id, name, enabled = true, instruction = 'Do the thing.') => ({ id, name, enabled, instruction })

const cases = []
const add = (name, settings, deployment, expected) => cases.push({ name, settings, deployment, expected })

const validFullSettings = {
  ...baseSettings,
  policy: {
    rules: [rule('copy', 'Copy fixes'), rule('visual', 'Visual fixes')],
    sources: {
      github: {
        allowed: [{ id: 'alice', name: 'Alice' }],
        admission: { issues: { listedUnaddressed: 'inferred' }, pulls: { listedUnaddressed: 'inferred' } },
        bots: [{ id: 'dependabot[bot]', name: 'Dependabot' }],
      },
    },
  },
  eval: { mode: 'auto', timeoutSeconds: 120, model: null },
  executor: { model: null, maxWorkers: 3, directory: '', prepare: 'pnpm install --frozen-lockfile', blockedCommands: ['npm'] },
  sources: { github: github({ repository: 'deepseek-ai/dsh-superagent-prototype', observeIssues: true, observePulls: true }) },
}

// Happy paths
add('01-valid-empty', baseSettings, baseDeployment, [])
add('02-valid-full', validFullSettings, baseDeployment, [])
add('03-valid-default-rules', {
  ...baseSettings,
  policy: { rules: [rule('a', 'A')], sources: {} },
  eval: { mode: 'observe' },
}, baseDeployment, [])

// Plugin Config
add('04-dep-all-invalid', baseSettings, {
  stateDir: 'C:/dsh',
  promptMaxChars: 10,
  admissionContextMaxPages: 0,
  admissionContextTimeoutMs: 99999,
  worktreeRoot: 'old',
  github: { repository: 'bad', cli: '' },
}, ['DEP001', 'DEP002', 'DEP003', 'DEP004', 'DEP005'])
add('05-dep-not-object', baseSettings, 42, ['DEP000'])
add('06-dep-valid-no-github', baseSettings, baseDeployment, [])

// Policy, eval, executor
add('07-policy-all-invalid', {
  ...baseSettings,
  policy: {
    rules: [
      { id: 'bad id', name: '', enabled: 'yes', instruction: '', extra: 1 },
      rule('dup', 'Dup'),
      rule('dup', 'Dup2', true, 'y'),
    ],
    sources: {},
  },
}, baseDeployment, ['POL002', 'POL003', 'POL004', 'POL005', 'POL006', 'POL007'])
add('08-policy-not-object', { ...baseSettings, policy: 'x' }, baseDeployment, ['POL000'])
add('09-rules-not-array', { ...baseSettings, policy: { rules: {}, sources: {} } }, baseDeployment, ['POL001'])
add('10-policy-unknown-key', { ...baseSettings, policy: { rules: [], sources: {}, autoSync: true } }, baseDeployment, ['POL008'])

add('11-source-policy-invalid', {
  ...baseSettings,
  policy: {
    rules: [],
    sources: {
      Bad: { allowed: [{}], admission: { r: { unlistedAddresed: 'ignore' } }, bots: ['x'], allowedSync: 1 },
      github: { allowed: [{ id: 'a' }, { id: 'A' }], admission: [] },
    },
  },
  sources: { Bad: { enabled: true, config: {} }, github: github() },
}, baseDeployment, ['SRC001', 'SRC002', 'SRC003', 'SRC004', 'SRC006', 'SRC007', 'SRC008', 'SEM007', 'SEM011', 'X003', 'X006'])
add('12-admission-value', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issues: { listedUnaddressed: 'explicitx' } } } } },
  sources: { github: github({ observeIssues: true }) },
}, baseDeployment, ['SRC005'])
add('13-sources-not-object', { ...baseSettings, sources: [] }, baseDeployment, ['X003', 'X004'])
add('14-admission-not-object', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: [] } } },
  sources: { github: github() },
}, baseDeployment, ['SRC004'])

add('15-eval-all-invalid', {
  ...baseSettings,
  eval: { mode: 'sometimes', timeoutSeconds: 5, model: { provider: '' }, retries: 1 },
}, baseDeployment, ['EVAL001', 'EVAL002', 'EVAL003', 'EVAL004'])
add('16-eval-not-object', { ...baseSettings, eval: 1 }, baseDeployment, ['EVAL000'])
add('17-executor-all-invalid', {
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
add('18-executor-not-object', { ...baseSettings, executor: [] }, baseDeployment, ['EXE000'])

// Cross-block and source instances
add('19-cross-top', {
  ...baseSettings,
  nope: 1,
  paused: 'no',
  sources: { github: { enabled: 'yes', config: 1 } },
}, baseDeployment, ['X001', 'X002', 'X003', 'DEP006'])
add('20-settings-not-object', 42, baseDeployment, ['X000'])
add('21-source-instance-unknown-key', {
  ...baseSettings,
  sources: { github: { enabled: true, config: { repository: 'owner/name', cli: 'gh' }, extra: 1 } },
}, baseDeployment, ['X003'])

// Semantics
add('22-sem-mode-off', { ...baseSettings, eval: { mode: 'off' }, policy: { rules: [rule('a', 'A')], sources: {} } }, baseDeployment, ['SEM001'])
add('23-sem-auto-no-rules', { ...baseSettings, eval: { mode: 'auto' } }, baseDeployment, ['SEM002'])
add('24-sem-explicit', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issues: { unlistedAddressed: 'explicit' } } } } },
  sources: { github: github({ observeIssues: true }) },
}, baseDeployment, ['SEM003'])
add('25-sem-unavailable-cell', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issues: { listedUnaddressed: 'inferred' } } } } },
  sources: { github: github({ observeIssues: false }) },
}, baseDeployment, ['SEM004'])
add('26-sem-feishu-cell', {
  ...baseSettings,
  policy: { rules: [], sources: { feishu: { allowed: [{ id: 'ou_a' }], admission: { oc_a: { listedUnaddressed: 'inferred' } } } } },
  sources: {
    github: github(),
    feishu: { enabled: true, config: { cli: 'lark-cli', chats: [{ chatId: 'oc_a', listen: 'mentions' }] } },
  },
}, baseDeployment, ['SEM004'])
add('27-sem-worker-command', { ...baseSettings, executor: { blockedCommands: ['gh'] } }, baseDeployment, ['SEM005'])
add('28-sem-paused', { ...baseSettings, paused: true }, baseDeployment, ['SEM006'])
add('29-sem-disabled-instance', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }] } } },
  sources: { github: { enabled: false, config: { repository: 'owner/name', cli: 'gh' } } },
}, baseDeployment, ['SEM007'])
add('30-sem-allowed-empty', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [], admission: { issues: { listedUnaddressed: 'inferred' } } } } },
  sources: { github: github({ observeIssues: true }) },
}, baseDeployment, ['SEM008'])
add('31-sem-duplicate-name', {
  ...baseSettings,
  policy: { rules: [rule('a', 'Fix'), rule('b', 'fix')], sources: {} },
}, baseDeployment, ['SEM009'])
add('32-sem-all-disabled', {
  ...baseSettings,
  policy: { rules: [rule('a', 'A', false)], sources: {} },
}, baseDeployment, ['SEM010'])
add('33-sem-row-never-produced', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], admission: { issue: { listedUnaddressed: 'inferred' } } } } },
  sources: { github: github({ observeIssues: true }) },
}, baseDeployment, ['SEM011'])

// Cross-source requirements
add('34-x004-no-github', {
  ...baseSettings,
  sources: {},
}, baseDeployment, ['X004'])
add('35-x005-feishu-no-cli', {
  ...baseSettings,
  policy: { rules: [], sources: { feishu: { allowed: [{ id: 'ou_a' }] } } },
  sources: { github: github(), feishu: { enabled: true, config: {} } },
}, baseDeployment, ['X005'])
add('36-x006-unknown-kind', {
  ...baseSettings,
  policy: { rules: [], sources: { telegram: { allowed: [{ id: 'a' }] } } },
  sources: { github: github(), telegram: { enabled: true, config: {} } },
}, baseDeployment, ['X006', 'SEM007'])

// Source config shape
add('37-github-repository', {
  ...baseSettings,
  sources: { github: github({ repository: 'bad' }) },
}, baseDeployment, ['DEP006'])
add('38-github-cli', {
  ...baseSettings,
  sources: { github: github({ cli: '' }) },
}, baseDeployment, ['DEP007'])
add('39-github-unknown-key', {
  ...baseSettings,
  sources: { github: github({ branchPrefix: 'x' }) },
}, baseDeployment, ['DEP008'])
add('40-feishu-unknown-key', {
  ...baseSettings,
  sources: { github: github(), feishu: { enabled: true, config: { clii: 'x' } } },
}, baseDeployment, ['DEP009'])
add('41-feishu-chat-invalid', {
  ...baseSettings,
  sources: {
    github: github(),
    feishu: { enabled: true, config: { cli: 'lark-cli', chats: [{ chatId: 'bad', listen: 'sometimes' }, { chatId: 'oc_a', listen: 'all' }, { chatId: 'oc_a', listen: 'all' }] } },
  },
}, baseDeployment, ['DEP011'])
add('42-sem-duplicate-bot', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [], bots: [{ id: 'dependabot[bot]' }, { id: 'dependabot[bot]' }], admission: { issues: { listedUnaddressed: 'inferred' } } } } },
  sources: { github: github({ observeIssues: true }) },
}, baseDeployment, ['SEM008', 'SRC009'])

// Combined and duplicates
add('43-combined-risky', {
  paused: true,
  policy: {
    rules: [rule('copy', 'Copy fixes')],
    sources: { github: { allowed: [{ id: 'alice' }], admission: { issues: { unlistedAddressed: 'explicit' } } } },
  },
  eval: { mode: 'off' },
  executor: { blockedCommands: ['gh'] },
  sources: { github: github({ observeIssues: true }) },
}, baseDeployment, ['SEM001', 'SEM003', 'SEM005', 'SEM006'])
add('44-sem-duplicate-allowed', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'alice' }, { id: 'Alice' }] } } },
  sources: { github: github() },
}, baseDeployment, ['SRC003'])
add('45-sem-unknown-source-key', {
  ...baseSettings,
  policy: { rules: [], sources: { github: { allowed: [{ id: 'a' }], autoSync: true } } },
  sources: { github: github() },
}, baseDeployment, ['SRC008'])

add('46-dep-github-poll', {
  ...baseSettings,
  sources: { github: github({ pollSeconds: 5 }) },
}, baseDeployment, ['DEP010'])
add('47-policy-sources-null', {
  ...baseSettings,
  policy: { rules: [], sources: null },
}, baseDeployment, ['SRC000'])

mkdirSync(root, { recursive: true })
for (const item of cases) {
  const dir = join(root, item.name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'settings.json'), JSON.stringify(item.settings, null, 2) + '\n')
  writeFileSync(join(dir, 'deployment.json'), JSON.stringify(item.deployment, null, 2) + '\n')
  const failed = item.expected.some(code => CATALOG_BY_CODE.get(code)?.severity === 'error')
  const report = validate(item.settings, item.deployment)
  const diagnostics = report.diagnostics.map(({ code, severity, path }) => ({ code, severity, path }))
  writeFileSync(join(dir, 'expected.json'), JSON.stringify({ exitCode: failed ? 1 : 0, codes: item.expected, diagnostics }, null, 2) + '\n')
}
console.log(`wrote ${cases.length} cases to ${root}`)

