/**
 * Domain constants and default projection.
 *
 * Every constant here is copied from the dsh-superagent prototype snapshot
 * (2026-10-31, POLICY_REVISION=mandate-v3). Keep the upstream file/line in the
 * comment next to it: this file is the single source of truth for the validator,
 * and a drift here silently changes every rule downstream.
 */

/** src/limits.ts:2-11 */
export const LIMITS = Object.freeze({
  ruleName: 100,
  ruleInstruction: 2000,
  evalTimeoutSeconds: { min: 30, max: 600 },
  maxWorkers: { min: 1, max: 16 },
  prepareCommand: 4000,
  promptMaxChars: { min: 1000, max: 1_000_000 },
  admissionContextMaxPages: { min: 1, max: 100 },
  admissionContextTimeoutMs: { min: 1, max: 90_000 },
})

/** src/policy.ts:111 */
export const POLICY_REVISION = 'mandate-v3'

/** src/policy.ts:13 — RuleIdSchema */
export const RULE_ID_RE = /^[a-zA-Z0-9_-]{1,80}$/

/** src/policy.ts:81 — source name regex in PolicyConfigSchema */
export const SOURCE_NAME_RE = /^[a-z][a-z0-9-]*$/

/** src/policy.ts:88 — blocked command names */
export const COMMAND_RE = /^[A-Za-z0-9._-]+$/

/** src/infra/environment.ts:18 — commands the worker itself needs */
export const WORKER_COMMANDS = Object.freeze(['gh', 'git', 'lark-cli'])

/** src/admission.ts:4-11 */
export const ADMISSION_CELLS = Object.freeze([
  'listedUnaddressed',
  'unlistedAddressed',
  'unlistedUnaddressed',
])
export const ADMISSION_OPTIONS = Object.freeze({
  listedUnaddressed: Object.freeze(['inferred', 'ignore']),
  unlistedAddressed: Object.freeze(['explicit', 'inferred', 'ignore']),
  unlistedUnaddressed: Object.freeze(['inferred', 'ignore']),
})
/** src/admission.ts:13 */
export const ADMISSION_DEFAULTS = Object.freeze({
  listedUnaddressed: 'inferred',
  unlistedAddressed: 'ignore',
  unlistedUnaddressed: 'ignore',
})

/** src/deployment.ts:31-35 — keys that moved elsewhere; the error names the new home. */
export const MOVED = Object.freeze({
  repository: 'on the GitHub Source',
  branchPrefix: 'in the prepare command of the Execution settings',
  github: 'on the GitHub Source',
  feishu: 'on the Feishu Source',
  author: 'prompt text',
  repositoryPath: 'in the prepare command of the Execution settings',
  worktreeRoot: 'the ticket directory of the Execution settings',
  blockedCommands: 'in the Execution settings',
})

/**
 * src/policy.ts:62-65 — the built-in rules that apply when `policy.rules` is
 * omitted. They are part of the Policy version, so the validator must project
 * them exactly like zod's `.default(DEFAULT_RULES)` does.
 */
export const DEFAULT_RULES = Object.freeze([
  Object.freeze({
    id: 'copy',
    name: 'Copy fixes',
    enabled: true,
    instruction:
      'Explicit requests to correct a typo, wording, punctuation or existing translation. Preserve product promises and business meaning.',
  }),
  Object.freeze({
    id: 'visual',
    name: 'Visual fixes',
    enabled: true,
    instruction:
      'Explicit implementation requests for local spacing, alignment, overflow or styling, with a specified target or an objectively established existing standard/correct state to restore. Locating an element or calling it inconsistent, unattractive or hard to understand does not establish a target. Do not invent visual style, information hierarchy, rendering or interaction decisions. No redesign, new interaction or behavior. A known spacing defect does not authorize adjacent undefined restyling; assess only a clearly separable authorized scope. If direction or scope is unsettled, observe only: no acknowledgement, worker or unsolicited question.',
  }),
])

export const isPlainObject = value =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const clone = value => JSON.parse(JSON.stringify(value))

/** Case-insensitive comparison, matching src/infra/text.ts:19 `sameName`. */
export const sameName = (a, b) => String(a).toLowerCase() === String(b).toLowerCase()

const objectOr = (value, fallback) => (isPlainObject(value) ? value : fallback)

/**
 * Expand a Settings object with the same defaults zod applies in
 * src/policy.ts:79-105. Unknown keys are preserved on purpose: the structure
 * checks report them; dropping them here would hide the problem.
 */
export function normalizeSettings(input) {
  const raw = objectOr(input, {})
  const policy = objectOr(raw.policy, {})
  const evalRaw = objectOr(raw.eval, {})
  const executor = objectOr(raw.executor, {})
  return {
    ...raw,
    paused: typeof raw.paused === 'boolean' ? raw.paused : false,
    sources: objectOr(raw.sources, {}),
    policy: {
      ...policy,
      rules: Array.isArray(policy.rules) ? policy.rules : clone(DEFAULT_RULES),
      sources: objectOr(policy.sources, {}),
    },
    eval: {
      ...evalRaw,
      mode: evalRaw.mode ?? 'observe',
      timeoutSeconds: evalRaw.timeoutSeconds ?? 120,
      model: evalRaw.model ?? null,
    },
    executor: {
      ...executor,
      model: executor.model ?? null,
      maxWorkers: executor.maxWorkers ?? 3,
      directory: executor.directory ?? '',
      prepare: executor.prepare ?? '',
      blockedCommands: Array.isArray(executor.blockedCommands) ? executor.blockedCommands : [],
    },
  }
}

/**
 * Expand a plugin Config object with the schemastery defaults from
 * src/deployment.ts:15-23. `stateDir` has no default: a missing value is a
 * finding, not something to paper over.
 */
export function normalizeDeployment(input) {
  const raw = objectOr(input, {})
  return {
    ...raw,
    promptMaxChars: raw.promptMaxChars ?? 100_000,
    admissionContextMaxPages: raw.admissionContextMaxPages ?? 10,
    admissionContextTimeoutMs: raw.admissionContextTimeoutMs ?? 15_000,
  }
}

/** The enabled rules of a normalized settings object, in declaration order. */
export const enabledRules = settings => settings.policy.rules.filter(rule => rule?.enabled === true)
