/**
 * Diagnostic report model.
 *
 * One shape for every check, one stable order, one exit code. CI diffs the JSON
 * between commits, so field order and array order must not depend on Map
 * iteration or filesystem order.
 */
export const SEVERITY_ORDER = Object.freeze({ error: 0, warning: 1, info: 2 })
export const SEVERITIES = Object.freeze(['error', 'warning', 'info'])

/** Mark every upstream reference so a reader does not mistake it for this repo's src/. */
function markSource(value) {
  const text = String(value ?? '')
  if (!text) return ''
  return text.replace(/(^|[;\s])((?:src|docs)\/)/g, '$1upstream:$2')
}

/** Fill optional fields so every diagnostic has the same keys, in the same order. */
export function normalizeDiagnostic(item) {
  return {
    code: String(item.code),
    severity: SEVERITIES.includes(item.severity) ? item.severity : 'warning',
    path: String(item.path ?? ''),
    message: String(item.message ?? ''),
    consequence: String(item.consequence ?? ''),
    hint: String(item.hint ?? ''),
    source: markSource(item.source),
  }
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const rank = (a, b) => (SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]) || cmp(a.path, b.path) || cmp(a.code, b.code)

/** Stable, deduplicated diagnostics. */
export function sortDiagnostics(diagnostics) {
  const seen = new Set()
  const unique = []
  for (const raw of diagnostics.map(normalizeDiagnostic)) {
    const key = `${raw.code}\u0000${raw.path}\u0000${raw.message}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(raw)
  }
  return unique.sort(rank)
}

/**
 * Build the report object. `options.strict` turns warnings into a failing exit
 * code; `options.maxWarnings` fails when the warning count exceeds the budget.
 */
export function buildReport(diagnostics, options = {}) {
  const items = sortDiagnostics(diagnostics)
  const summary = { error: 0, warning: 0, info: 0 }
  for (const item of items) summary[item.severity] += 1
  const strict = options.strict === true
  const budget = Number.isInteger(options.maxWarnings) ? options.maxWarnings : null
  const overBudget = budget !== null && summary.warning > budget
  const expectation = options.expectVersion === undefined || options.expectVersion === null
    ? null
    : {
        expected: String(options.expectVersion),
        actual: options.policyVersion ?? null,
        match: String(options.expectVersion) === String(options.policyVersion ?? ''),
      }
  const failed = summary.error > 0 || (strict && summary.warning > 0) || overBudget || (expectation !== null && !expectation.match)
  return {
    tool: 'dsh-superagent-policy-validator',
    schemaVersion: 1,
    revision: options.revision ?? null,
    policyVersion: options.policyVersion ?? null,
    inputs: {
      settings: options.settingsPath ?? null,
      deployment: options.deploymentPath ?? null,
    },
    expectation,
    ok: !failed,
    summary,
    strict,
    maxWarnings: budget,
    diagnostics: items,
  }
}

/** Exit code convention: 0 clean, 1 findings, 2 usage/IO error. */
export const exitCodeOf = report => (report.ok ? 0 : 1)

/** Human-readable report, intentionally terse. */
export function renderText(report) {
  const lines = []
  const where = report.inputs.settings ? ` (${report.inputs.settings})` : ''
  lines.push(`dsh-superagent policy check${where}`)
  if (report.revision) lines.push(`policy revision: ${report.revision}${report.policyVersion ? `  version: ${report.policyVersion}` : ''}`)
  else if (report.policyVersion) lines.push(`policy version: ${report.policyVersion}`)
  if (!report.diagnostics.length) {
    lines.push('OK — no findings.')
    return lines.join('\n')
  }
  for (const item of report.diagnostics) {
    lines.push(`${item.severity.toUpperCase()} ${item.code} ${item.path}`)
    lines.push(`  ${item.message}`)
    if (item.consequence) lines.push(`  consequence: ${item.consequence}`)
    if (item.hint) lines.push(`  fix: ${item.hint}`)
    if (item.source) lines.push(`  source: ${item.source}`)
  }
  lines.push('')
  lines.push(`${report.summary.error} error(s), ${report.summary.warning} warning(s), ${report.summary.info} info`)
  return lines.join('\n')
}
