/**
 * Admission matrix projection.
 *
 * docs/002-authorization.md §Admission defines three cells per receiving scope.
 * A listed sender who addresses the agent is always explicit and uses no cell
 * (src/policy.ts:197); every other case reads the cell. Rows come from the
 * Source kind's `policy.rows(stored)` (src/sources/github.ts:80-90,
 * src/sources/feishu.ts:90-101), so an admission row that the Source never
 * produces is visible instead of silently looking valid.
 */
import {
  ADMISSION_CELLS,
  ADMISSION_DEFAULTS,
  ADMISSION_OPTIONS,
  normalizeSettings,
} from './model.js'
import { sourceRows } from './kinds.js'

export const LISTED_ADDRESSED_RULE =
  'A listed sender who addresses the agent is always explicit and does not read an admission cell (upstream:src/policy.ts:197).'

function effectiveCell(rowValue, cell, available) {
  const configured = rowValue?.[cell]
  return {
    value: configured ?? ADMISSION_DEFAULTS[cell],
    source: configured === undefined ? 'default' : 'config',
    available,
    allowed: [...ADMISSION_OPTIONS[cell]],
  }
}

function projectRow(source, row) {
  const table = source.table
  const rowValue = row.id === '<default>' ? undefined : table[row.id]
  return {
    row: row.id,
    label: row.label,
    note: row.note,
    cells: Object.fromEntries(
      ADMISSION_CELLS.map(cell => [cell, effectiveCell(rowValue, cell, row.cells[cell])]),
    ),
  }
}

/**
 * Build the matrix for every policy source: the rows the Source kind actually
 * produces, any configured-but-never-produced row, and one `<default>` row so
 * the global defaults are always visible.
 */
export function admissionMatrix(settingsInput) {
  const settings = normalizeSettings(settingsInput)
  const sources = settings.policy.sources
  return Object.keys(sources).map(source => {
    const part = sources[source]
    const table = part && typeof part === 'object' && !Array.isArray(part) && part.admission && typeof part.admission === 'object'
      ? part.admission
      : {}
    const { known, rows } = sourceRows(settings, source)
    const produced = new Set(rows.map(row => row.id))
    const extra = Object.keys(table)
      .filter(id => !produced.has(id))
      .map(id => ({ id, label: '(never produced)', note: 'row not produced by this Source kind', cells: { listedUnaddressed: null, unlistedAddressed: null, unlistedUnaddressed: null } }))
    const all = [
      ...rows,
      ...extra,
      { id: '<default>', label: '(defaults)', note: '', cells: { listedUnaddressed: true, unlistedAddressed: true, unlistedUnaddressed: true } },
    ]
    return {
      source,
      known,
      rows: all.map(row => projectRow({ table }, row)),
    }
  })
}

/** Human-readable table, used by `matrix --format text`. */
export function renderMatrixText(matrix) {
  const lines = []
  for (const source of matrix) {
    lines.push(`source: ${source.source}${source.known ? '' : '  (unknown Source kind; rows cannot be projected)'}`)
    lines.push('  row'.padEnd(26) + 'listed/unaddressed'.padEnd(24) + 'unlisted/addressed'.padEnd(24) + 'unlisted/unaddressed')
    for (const row of source.rows) {
      const fmt = cell => `${cell.available === false ? 'x ' : ''}${cell.value} (${cell.source})`
      lines.push('  ' + row.row.padEnd(24) + fmt(row.cells.listedUnaddressed).padEnd(24) + fmt(row.cells.unlistedAddressed).padEnd(24) + fmt(row.cells.unlistedUnaddressed))
    }
    lines.push('')
  }
  lines.push(LISTED_ADDRESSED_RULE)
  lines.push('x = this row never offers that cell, so a value there is dead.')
  return lines.join('\n')
}
