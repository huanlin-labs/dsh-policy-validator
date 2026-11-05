/**
 * Policy version and change impact.
 *
 * src/policy.ts:111-118 defines the version as a content hash of
 * {rules, mode, sources}; docs/002-authorization.md §Policy version explains
 * what a change does to live Tickets: running Evals are discarded, affected
 * Tickets receive a policy-changed Input, and revalidation may revoke a Mandate.
 */
import { createHash } from 'node:crypto'
import { POLICY_REVISION, isPlainObject, normalizeSettings } from './model.js'

/** src/core/ids.ts:3-5 — sha256 over JSON.stringify(values), first 32 hex chars. */
export function key(...values) {
  return createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 32)
}

const pick = (value, fields) => {
  const out = {}
  for (const field of fields) if (value?.[field] !== undefined) out[field] = value[field]
  return out
}

const trimmed = value => (typeof value === 'string' ? value.trim() : value)

/** Canonical rule shape in RuleSchema declaration order (src/policy.ts:67). */
const canonicalRule = rule => {
  const out = pick(rule, ['id', 'name', 'enabled', 'instruction'])
  if (typeof out.name === 'string') out.name = trimmed(out.name)
  if (typeof out.instruction === 'string') out.instruction = trimmed(out.instruction)
  return out
}

/** Canonical allowed entry in AllowedSchema declaration order (src/policy.ts:73). */
const canonicalAllowed = entry => {
  const out = pick(entry, ['id', 'name'])
  if (typeof out.id === 'string') out.id = trimmed(out.id)
  if (typeof out.name === 'string') out.name = trimmed(out.name)
  return out
}

/** Canonical admission row in AdmissionRowSchema declaration order (src/policy.ts:75). */
const canonicalRow = row =>
  pick(row, ['listedUnaddressed', 'unlistedAddressed', 'unlistedUnaddressed'])

/**
 * Canonical Source Policy: shape keys first (allowed, admission), then any
 * catchall keys (for example `bots`) in their input order — the order zod
 * produces when it parses SourcePolicySchema.
 */
function canonicalSourcePolicy(part = {}) {
  if (!isPlainObject(part)) return { allowed: [], admission: {} }
  const { allowed, admission, ...rest } = part
  return {
    allowed: Array.isArray(allowed) ? allowed.map(canonicalAllowed) : [],
    admission: Object.fromEntries(
      Object.entries(isPlainObject(admission) ? admission : {}).map(
        ([row, value]) => [row, canonicalRow(value)],
      ),
    ),
    ...rest,
  }
}

/** The exact projection that feeds the hash. Exported so `version` can show it. */
export function canonicalPolicy(settingsInput) {
  const settings = normalizeSettings(settingsInput)
  return {
    rules: settings.policy.rules.map(canonicalRule),
    mode: settings.eval.mode,
    sources: Object.fromEntries(
      Object.entries(settings.policy.sources).map(([name, part]) => [
        name,
        canonicalSourcePolicy(part),
      ]),
    ),
  }
}

/** Reproduce src/policy.ts:116-118 for the same snapshot. */
export function policyVersion(settingsInput) {
  const policy = canonicalPolicy(settingsInput)
  return key(POLICY_REVISION, JSON.stringify(policy))
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function ruleChanges(before, after) {
  const changes = []
  const oldById = new Map(before.rules.map(rule => [rule.id, rule]))
  const newById = new Map(after.rules.map(rule => [rule.id, rule]))
  for (const [id, rule] of oldById) {
    if (!newById.has(id)) changes.push({ area: 'rules', kind: 'removed', id })
    else if (!same(rule, newById.get(id))) changes.push({ area: 'rules', kind: 'changed', id })
  }
  for (const id of newById.keys()) if (!oldById.has(id)) changes.push({ area: 'rules', kind: 'added', id })
  return changes
}

function sourceChanges(before, after) {
  const changes = []
  for (const name of Object.keys(before.sources)) {
    if (!(name in after.sources)) changes.push({ area: 'sources', kind: 'removed', source: name })
    else if (!same(before.sources[name], after.sources[name]))
      changes.push({ area: 'sources', kind: 'changed', source: name })
  }
  for (const name of Object.keys(after.sources))
    if (!(name in before.sources)) changes.push({ area: 'sources', kind: 'added', source: name })
  return changes
}

/**
 * Compare two Settings objects by authorization impact.
 * `impacts` is deliberately about Mandates, not about the JSON: a changed rule
 * only matters to a Ticket whose Mandate matched that rule, and leaving `auto`
 * invalidates every inferred Mandate (src/policy.ts:221,238).
 */
export function comparePolicies(beforeInput, afterInput) {
  const before = canonicalPolicy(beforeInput)
  const after = canonicalPolicy(afterInput)
  const versionBefore = key(POLICY_REVISION, JSON.stringify(before))
  const versionAfter = key(POLICY_REVISION, JSON.stringify(after))
  const changes = [...ruleChanges(before, after)]
  if (before.mode !== after.mode)
    changes.push({ area: 'mode', kind: 'changed', from: before.mode, to: after.mode })
  changes.push(...sourceChanges(before, after))

  const impacts = []
  if (before.mode === 'auto' && after.mode !== 'auto')
    impacts.push({
      code: 'INFERRED_MANDATES_LOSE_AUTO',
      severity: 'warning',
      message:
        'Every Mandate accepted as inferred requires auto mode at revalidation; after this change they stay ended and their waiting messages go back to Eval.',
      source: 'src/policy.ts:221,238',
    })
  for (const change of changes.filter(item => item.area === 'rules' && item.kind !== 'added')) {
    const ruleAfter = after.rules.find(rule => rule.id === change.id)
    if (!ruleAfter || ruleAfter.enabled === false)
      impacts.push({
        code: 'MANDATES_LOSE_RULE',
        severity: 'warning',
        message: `Rule "${change.id}" is gone or disabled; inferred Mandates that matched it fail revalidation.`,
        source: 'src/policy.ts:219',
      })
  }
  for (const change of changes.filter(item => item.area === 'sources' && item.kind === 'removed'))
    impacts.push({
      code: 'MANDATES_LOSE_SOURCE',
      severity: 'warning',
      message: `Source "${change.source}" is no longer part of the Policy; its Mandates cannot revalidate.`,
      source: 'docs/002-authorization.md:133-141',
    })

  return {
    changed: versionBefore !== versionAfter,
    revision: POLICY_REVISION,
    versionBefore,
    versionAfter,
    changes,
    impacts,
  }
}
