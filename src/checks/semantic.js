/**
 * Semantic checks: configurations that pass the schema but do not mean what
 * their author expects. These are the checks upstream zod cannot express,
 * because the consequence depends on docs/002 semantics rather than shape.
 *
 * A diagnostic is a plain object:
 *   { code, severity, path, message, consequence, hint, source }
 */
import { WORKER_COMMANDS, normalizeSettings, sameName } from '../model.js'

const diag = (code, severity, path, message, consequence, hint, source) => ({
  code,
  severity,
  path,
  message,
  consequence,
  hint,
  source,
})

/** True/false when the stored Source config says whether a scope observes all messages; undefined when unknown. */
function observesAll(settings, source, row) {
  const config = settings.sources?.[source]?.config
  if (!config || typeof config !== 'object') return undefined
  if (config.receiveAll === false || config.allMessages === false || config.observeAll === false) return false
  if (config.receiveAll === true || config.allMessages === true || config.observeAll === true) return true
  if (Array.isArray(config.chats) && row) {
    const chat = config.chats.find(item => item && item.chatId === row)
    if (chat) return chat.listen === 'all'
  }
  return undefined
}

export function semanticDiagnostics(settingsInput) {
  const settings = normalizeSettings(settingsInput)
  const out = []
  const rules = settings.policy.rules
  const enabled = rules.filter(rule => rule?.enabled === true)
  const mode = settings.eval.mode
  const sources = settings.policy.sources

  if (mode === 'off' && enabled.length > 0) {
    out.push(diag('SEM001', 'warning', 'eval.mode',
      `accept mode is "off" but ${enabled.length} rule(s) are enabled`,
      'Inferred candidates are never created in off mode, so proactive rules cannot accept anything; only explicit requests start work.',
      'Use "observe" while reviewing Decisions, or set mode to "auto" once the rules are trusted.',
      'docs/002-authorization.md:91-99; src/policy.ts:55-58,184'))
  }

  if (mode === 'auto' && enabled.length === 0) {
    out.push(diag('SEM002', 'warning', 'policy.rules',
      'accept mode is "auto" but no rule is enabled',
      'admitsInferred requires at least one matched rule, so auto behaves like observe: nothing inferred is accepted.',
      'Enable at least one rule or use "observe" so the configuration states its real intent.',
      'src/policy.ts:212'))
  }

  for (const [source, part] of Object.entries(sources)) {
    const table = part && typeof part === 'object' && !Array.isArray(part) ? part.admission : undefined
    if (!table || typeof table !== 'object') continue
    for (const [row, cells] of Object.entries(table)) {
      if (!cells || typeof cells !== 'object') continue
      if (cells.unlistedAddressed === 'explicit') {
        out.push(diag('SEM003', 'warning', `policy.sources.${source}.admission.${row}.unlistedAddressed`,
          'anyone in this scope can make an explicit request by mentioning the agent',
          'The allowed list stops protecting this scope: an unlisted sender becomes an explicit request, works in every accept mode, and can start a Ticket.',
          'Keep "explicit" only for a dedicated support chat you actually want open to everyone; otherwise use "inferred" or "ignore".',
          'docs/002-authorization.md:56-73'))
      }
      for (const cell of ['listedUnaddressed', 'unlistedUnaddressed']) {
        if (cells[cell] === undefined) continue
        const observed = observesAll(settings, source, row)
        if (observed === false) {
          out.push(diag('SEM004', 'warning', `policy.sources.${source}.admission.${row}.${cell}`,
            `unaddressed cell "${cell}" is configured but this scope only receives mentions`,
            'The cell is unreachable: unaddressed messages never reach this scope, so its value cannot affect any Trigger.',
            'Set the scope to receive all messages, or remove the cell to avoid a false sense of control.',
            'docs/002-authorization.md:63-71; src/policy.ts:199-201'))
        }
      }
    }
  }

  const blocked = Array.isArray(settings.executor.blockedCommands) ? settings.executor.blockedCommands : []
  for (const [index, name] of blocked.entries()) {
    if (WORKER_COMMANDS.some(command => sameName(command, name))) {
      out.push(diag('SEM005', 'error', `executor.blockedCommands[${index}]`,
        `"${name}" is a worker command and cannot be blocked`,
        'The executor needs this command to run a Ticket; upstream rejects the whole configuration instead of silently ignoring it.',
        `Remove "${name}" from blockedCommands.`,
        'src/policy.ts:88-89; src/infra/environment.ts:18'))
    }
  }

  if (settings.paused === true) {
    out.push(diag('SEM006', 'warning', 'paused',
      'the service is paused',
      'No new work starts while paused; the rest of the Policy is inert until someone resumes it.',
      'Check this is intentional before comparing two Policy versions or handing the file to someone else.',
      'src/policy.ts:190'))
  }

  for (const source of Object.keys(sources)) {
    const instance = settings.sources?.[source]
    if (!instance) {
      out.push(diag('SEM007', 'warning', `policy.sources.${source}`,
        `policy for "${source}" has no Source instance`,
        'Without an instance this Policy part never sees a Trigger; its rules and admission cells are dead weight.',
        `Add settings.sources.${source} or remove the policy block.`,
        'src/policy.ts:99-105; src/sources/registry.ts'))
    } else if (instance.enabled === false) {
      out.push(diag('SEM007', 'warning', `policy.sources.${source}`,
        `Source instance "${source}" is disabled`,
        'A disabled Source receives nothing, so every rule and admission cell for it is unreachable.',
        'Enable the instance or remove its Policy part.',
        'src/policy.ts:98; docs/002-authorization.md:119-121'))
    }
    const allowed = Array.isArray(sources[source]?.allowed) ? sources[source].allowed : []
    const rows = sources[source]?.admission && Object.keys(sources[source].admission).length
    if (allowed.length === 0 && rows) {
      out.push(diag('SEM008', 'info', `policy.sources.${source}.allowed`,
        `"${source}" has admission rows but no allowed sender`,
        'Only the unlisted cells can admit anyone; the "listed sender" shortcuts never apply.',
        'Add the people or bots you expect to work with, or confirm the scope is intentionally open.',
        'docs/002-authorization.md:56-71'))
    }
  }

  const names = new Map()
  for (const rule of rules) {
    if (!rule || typeof rule.name !== 'string') continue
    const key = rule.name.trim().toLowerCase()
    if (names.has(key)) {
      out.push(diag('SEM009', 'warning', `policy.rules[${rules.indexOf(rule)}].name`,
        `rule name "${rule.name}" is used by more than one rule`,
        'Assessments record rule IDs, but the model prompt and the panel show names; duplicate names make a Decision hard to audit.',
        'Give each rule a distinct name.',
        'src/policy.ts:63-68'))
    }
    names.set(key, true)
  }

  if (rules.length > 0 && enabled.length === 0) {
    out.push(diag('SEM010', 'warning', 'policy.rules',
      'every rule is disabled',
      'No assessment can match a rule, so an accept always ends as noRuleMatched; proactive work can never start.',
      'Enable the rules that should apply, or remove them so the Policy says what it does.',
      'src/policy.ts:41-52'))
  }

  return out
}
