/**
 * Admission matrix projection.
 *
 * docs/002-authorization.md §Admission defines three cells per receiving scope.
 * A listed sender who addresses the agent is always explicit and uses no cell
 * (src/policy.ts:197); every other case reads the cell. This module answers one
 * question for a reviewer: "for this scope, what does each kind of sender get?"
 */
import {
  ADMISSION_CELLS,
  ADMISSION_DEFAULTS,
  ADMISSION_OPTIONS,
  normalizeSettings,
} from './model.js'

export const LISTED_ADDRESSED_RULE =
  'A listed sender who addresses the agent is always explicit and does not read an admission cell (src/policy.ts:197).'

/** One effective cell: value, where it came from, and the allowed choices. */
function effectiveCell(row, cell, rowValue) {
  const configured = rowValue?.[cell]
  return {
    value: configured ?? ADMISSION_DEFAULTS[cell],
    source: configured === undefined ? 'default' : 'config',
    allowed: [...ADMISSION_OPTIONS[cell]],
  }
}

/**
 * Build the matrix for every policy source.
 * A source whose admission table is empty still gets one `<default>` row so a
 * reviewer can see the global defaults instead of an empty table.
 */
export function admissionMatrix(settingsInput) {
  const settings = normalizeSettings(settingsInput)
  const sources = settings.policy.sources
  return Object.keys(sources).map(source => {
    const table = sources[source]?.admission
    const rows = table && typeof table === 'object' && !Array.isArray(table) ? Object.keys(table) : []
    const rowNames = rows.length ? rows : ['<default>']
    return {
      source,
      rows: rowNames.map(row => {
        const rowValue = row === '<default>' ? undefined : table[row]
        return {
          row,
          cells: Object.fromEntries(
            ADMISSION_CELLS.map(cell => [cell, effectiveCell(row, cell, rowValue)]),
          ),
        }
      }),
    }
  })
}

/** Human-readable table, used by `matrix --format text`. */
export function renderMatrixText(matrix) {
  const lines = []
  for (const source of matrix) {
    lines.push(`source: ${source.source}`)
    lines.push('  row'.padEnd(26) + 'listed/unaddressed'.padEnd(22) + 'unlisted/addressed'.padEnd(22) + 'unlisted/unaddressed')
    for (const row of source.rows) {
      const c = row.cells
      const fmt = cell => `${cell.value} (${cell.source})`
      lines.push('  ' + row.row.padEnd(24) + fmt(c.listedUnaddressed).padEnd(22) + fmt(c.unlistedAddressed).padEnd(22) + fmt(c.unlistedUnaddressed))
    }
    lines.push('')
  }
  lines.push(LISTED_ADDRESSED_RULE)
  return lines.join('\n')
}
