/**
 * Rule catalog: the public list of diagnostic codes.
 * `rules` prints it; docs/UPSTREAM.md maps it to the upstream snapshot.
 * Keep this list in sync with the checks — the test suite asserts that every
 * emitted code exists here and every code here is reachable from a fixture.
 */
export const CATALOG = [
  // Deployment (plugin Config)
  ['DEP000', 'error', 'deployment', 'Deployment config is not an object'],
  ['DEP001', 'error', 'deployment', 'stateDir missing or not an absolute POSIX path'],
  ['DEP002', 'error', 'deployment', 'Unknown deployment key (reports where deprecated keys moved)'],
  ['DEP003', 'error', 'deployment', 'promptMaxChars outside 1000..1000000'],
  ['DEP004', 'error', 'deployment', 'admissionContextMaxPages outside 1..100'],
  ['DEP005', 'error', 'deployment', 'admissionContextTimeoutMs outside 1..90000'],
  ['DEP006', 'error', 'deployment', 'github.repository empty or not owner/name'],
  ['DEP007', 'error', 'deployment', 'github.cli empty'],
  ['DEP008', 'error', 'deployment', 'Unknown github key'],
  ['DEP009', 'error', 'deployment', 'feishu shape invalid'],
  // Policy rules
  ['POL000', 'error', 'policy', 'policy block shape invalid'],
  ['POL001', 'error', 'policy', 'rules is not an array'],
  ['POL002', 'error', 'policy', 'rule shape or unknown field invalid'],
  ['POL003', 'error', 'policy', 'rule id does not match ^[a-zA-Z0-9_-]{1,80}$'],
  ['POL004', 'error', 'policy', 'Duplicate rule id'],
  ['POL005', 'error', 'policy', 'Rule name empty or longer than 100 characters'],
  ['POL006', 'error', 'policy', 'Rule instruction empty or longer than 2000 characters'],
  ['POL007', 'error', 'policy', 'rule.enabled is not boolean'],
  // Sources and admission
  ['SRC000', 'error', 'source', 'policy.sources or a Source Policy is not an object'],
  ['SRC001', 'error', 'source', 'Invalid Source name'],
  ['SRC002', 'error', 'source', 'allowed entry shape or id invalid'],
  ['SRC003', 'warning', 'source', 'Duplicate allowed sender'],
  ['SRC004', 'error', 'source', 'admission table or row is not an object'],
  ['SRC005', 'error', 'source', 'Admission cell value not allowed'],
  ['SRC006', 'error', 'source', 'Unknown admission cell name'],
  ['SRC007', 'error', 'source', 'bots array or bot entry invalid'],
  ['SRC008', 'info', 'source', 'Unknown Source Policy key (kept by catchall)'],
  // Eval
  ['EVAL000', 'error', 'eval', 'eval block is not an object'],
  ['EVAL001', 'error', 'eval', 'eval.mode not off|observe|auto'],
  ['EVAL002', 'error', 'eval', 'timeoutSeconds outside 30..600'],
  ['EVAL003', 'error', 'eval', 'eval.model shape invalid'],
  ['EVAL004', 'error', 'eval', 'Unknown eval key'],
  // Executor
  ['EXE000', 'error', 'executor', 'executor block is not an object'],
  ['EXE001', 'error', 'executor', 'maxWorkers outside 1..16'],
  ['EXE002', 'error', 'executor', 'directory not empty and not absolute'],
  ['EXE003', 'error', 'executor', 'prepare longer than 4000 characters'],
  ['EXE004', 'error', 'executor', 'blockedCommands shape or command name invalid'],
  ['EXE005', 'warning', 'executor', 'Duplicate blocked command'],
  ['EXE006', 'error', 'executor', 'executor.model shape invalid'],
  ['EXE007', 'error', 'executor', 'Unknown executor key'],
  // Cross-block
  ['X000', 'error', 'cross', 'settings root is not an object'],
  ['X001', 'error', 'cross', 'Unknown top-level settings key'],
  ['X002', 'error', 'cross', 'paused is not boolean'],
  ['X003', 'error', 'cross', 'Source instance shape invalid'],
  ['X004', 'warning', 'cross', 'GitHub Policy without a deployment repository'],
  ['X005', 'warning', 'cross', 'Feishu Policy without feishu.cli'],
  // Semantics
  ['SEM001', 'warning', 'semantic', 'accept mode off makes every enabled rule inert'],
  ['SEM002', 'warning', 'semantic', 'auto mode with no enabled rule behaves like observe'],
  ['SEM003', 'warning', 'semantic', 'unlisted sender can make an explicit request'],
  ['SEM004', 'warning', 'semantic', 'Unaddressed admission cell on a mentions-only scope'],
  ['SEM005', 'error', 'semantic', 'blockedCommands contains a worker command'],
  ['SEM006', 'warning', 'semantic', 'Service is paused'],
  ['SEM007', 'warning', 'semantic', 'Policy Source has no instance or is disabled'],
  ['SEM008', 'info', 'semantic', 'Admission rows without an allowed sender'],
  ['SEM009', 'warning', 'semantic', 'Duplicate rule name'],
  ['SEM010', 'warning', 'semantic', 'Every rule is disabled'],
].map(([code, severity, category, title]) => ({ code, severity, category, title }))

export const CATALOG_BY_CODE = new Map(CATALOG.map(item => [item.code, item]))
