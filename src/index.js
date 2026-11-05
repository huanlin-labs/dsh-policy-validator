/** Public API: one import for embedders and the CLI. */
import { POLICY_REVISION } from './model.js'
import { policyVersion } from './version.js'
import { structureDiagnostics } from './checks/structure.js'
import { semanticDiagnostics } from './checks/semantic.js'
import { buildReport } from './report.js'

export * from './model.js'
export { key, policyVersion, comparePolicies, canonicalPolicy } from './version.js'
export { admissionMatrix, renderMatrixText, LISTED_ADDRESSED_RULE } from './matrix.js'
export { sourceRows, rowOf } from './kinds.js'
export { structureDiagnostics } from './checks/structure.js'
export { semanticDiagnostics } from './checks/semantic.js'
export { buildReport, renderText, sortDiagnostics, exitCodeOf, SEVERITY_ORDER } from './report.js'
export { CATALOG, CATALOG_BY_CODE } from './catalog.js'

/**
 * Validate a Settings object and an optional plugin Config.
 * Returns the report object from src/report.js; never throws for bad input
 * (only for programmer errors).
 */
export function validate(settings, deployment, options = {}) {
  const diagnostics = [
    ...structureDiagnostics(settings, deployment),
    ...semanticDiagnostics(settings),
  ]
  return buildReport(diagnostics, {
    ...options,
    revision: POLICY_REVISION,
    policyVersion: policyVersion(settings),
  })
}
