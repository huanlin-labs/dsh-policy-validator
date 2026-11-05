/**
 * Structural checks — the fallback layer.
 *
 * These mirror the zod/schemastery shapes in the upstream snapshot, but they
 * are deliberately a *subset*: the value of this tool is the semantic layer,
 * not re-implementing zod. Codes are grouped by the block they guard.
 *
 * Upstream references:
 *   DEP  src/deployment.ts:15-23, 31-51
 *   POL  src/policy.ts:13-16, 67-82
 *   SRC  src/policy.ts:73-82, src/admission.ts:9-10
 *   EVAL src/policy.ts:83-87
 *   EXE  src/policy.ts:88-97
 *   X    src/policy.ts:99-105
 */
import {
  ADMISSION_CELLS,
  ADMISSION_OPTIONS,
  COMMAND_RE,
  LIMITS,
  MOVED,
  RULE_ID_RE,
  SOURCE_NAME_RE,
  WORKER_COMMANDS,
  isPlainObject,
  sameName,
} from '../model.js'

const diag = (code, severity, path, message, consequence, hint, source) => ({
  code,
  severity,
  path,
  message,
  consequence,
  hint,
  source,
})

const isInt = value => typeof value === 'number' && Number.isInteger(value)
const typeName = value => (Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value)

function intInRange(out, code, path, value, min, max, label, source) {
  if (!isInt(value) || value < min || value > max) {
    out.push(diag(code, 'error', path,
      `${label} must be an integer between ${min} and ${max} (got ${JSON.stringify(value)})`,
      'Upstream rejects the saved settings block; the panel cannot store it and the service keeps the previous value.',
      `Set ${path} to an integer in [${min}, ${max}].`,
      source))
  }
}

function unknownKeys(out, code, path, value, allowed, source, severity = 'error') {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue
    const moved = MOVED[key]
    out.push(diag(code, severity, `${path}.${key}`,
      `unknown key "${key}"${moved ? ` (now ${moved})` : ''}`,
      'Upstream rejects unknown keys instead of ignoring them, so this block cannot be saved.',
      moved ? `Move it ${moved}.` : `Remove "${key}".`,
      source))
  }
}

/* ------------------------------------------------------------------ */
/* Deployment (plugin Config)                                          */
/* ------------------------------------------------------------------ */

function checkDeployment(raw, out) {
  if (!isPlainObject(raw)) {
    out.push(diag('DEP000', 'error', 'deployment',
      `deployment config must be an object (got ${typeName(raw)})`,
      'The plugin cannot read its Config; startup fails before any Source connects.',
      'Pass the object under the dsh-superagent plugin config.', 'src/deployment.ts:15-23'))
    return
  }
  const allowed = ['stateDir', 'promptMaxChars', 'admissionContextMaxPages', 'admissionContextTimeoutMs', 'github', 'feishu']
  unknownKeys(out, 'DEP002', 'deployment', raw, allowed, 'src/deployment.ts:37-43')

  if (typeof raw.stateDir !== 'string' || raw.stateDir === '') {
    out.push(diag('DEP001', 'error', 'stateDir',
      'stateDir is required',
      'Without a state directory the plugin has nowhere to put its database, locks and worker shims; setup cannot start.',
      'Set stateDir to an absolute POSIX path such as /srv/dsh-superagent.', 'src/deployment.ts:16,38-42'))
  } else if (!raw.stateDir.startsWith('/')) {
    out.push(diag('DEP001', 'error', 'stateDir',
      `stateDir must be an absolute path starting with "/" (got ${JSON.stringify(raw.stateDir)})`,
      'The startup check fails before the service can mount the plugin.',
      'Use a POSIX absolute path; on Windows use the WSL path, not a drive letter.', 'src/deployment.ts:13,16'))
  }

  if (raw.promptMaxChars !== undefined)
    intInRange(out, 'DEP003', 'promptMaxChars', raw.promptMaxChars,
      LIMITS.promptMaxChars.min, LIMITS.promptMaxChars.max, 'promptMaxChars', 'src/deployment.ts:17')
  if (raw.admissionContextMaxPages !== undefined)
    intInRange(out, 'DEP004', 'admissionContextMaxPages', raw.admissionContextMaxPages,
      LIMITS.admissionContextMaxPages.min, LIMITS.admissionContextMaxPages.max, 'admissionContextMaxPages', 'src/deployment.ts:19')
  if (raw.admissionContextTimeoutMs !== undefined)
    intInRange(out, 'DEP005', 'admissionContextTimeoutMs', raw.admissionContextTimeoutMs,
      LIMITS.admissionContextTimeoutMs.min, LIMITS.admissionContextTimeoutMs.max, 'admissionContextTimeoutMs', 'src/deployment.ts:21')

  if (raw.github !== undefined) {
    if (!isPlainObject(raw.github)) {
      out.push(diag('DEP006', 'error', 'github', 'github must be an object',
        'Setup cannot read the repository or CLI settings.', 'Use { repository, cli }.', 'src/deployment.ts:45-51'))
    } else {
      unknownKeys(out, 'DEP008', 'github', raw.github, ['repository', 'cli'], 'src/deployment.ts:45-51')
      const repository = raw.github.repository
      if (repository !== undefined && (typeof repository !== 'string' || !/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?$/.test(repository))) {
        out.push(diag('DEP006', 'error', 'github.repository',
          'repository must be empty or owner/name',
          'resolveDeployment throws repositoryUnreadable/Unreported; the GitHub Source never starts.',
          'Use "owner/name", e.g. "deepseek-ai/dsh-superagent-prototype".', 'src/deployment.ts:46,87-105'))
      } else if (!repository) {
        out.push(diag('DEP006', 'error', 'github.repository',
          'repository is empty',
          'resolveDeployment throws SetupError("repositoryUnset"), so the service stops in setup.',
          'Fill in owner/name before starting.', 'src/deployment.ts:90-91'))
      }
      if (raw.github.cli !== undefined && (typeof raw.github.cli !== 'string' || raw.github.cli.trim() === '')) {
        out.push(diag('DEP007', 'error', 'github.cli',
          'cli is empty',
          'resolveDeployment throws SetupError("agentCliUnset"); no GitHub account is verified.',
          'Set the gh executable name or absolute path.', 'src/deployment.ts:92-94'))
      }
    }
  }

  if (raw.feishu !== undefined && !isPlainObject(raw.feishu)) {
    out.push(diag('DEP009', 'error', 'feishu', 'feishu must be an object',
      'The optional Feishu Source cannot read its CLI setting.', 'Use { cli } or omit the key.', 'src/deployment.ts:49-51'))
  } else if (isPlainObject(raw.feishu)) {
    unknownKeys(out, 'DEP009', 'feishu', raw.feishu, ['cli'], 'src/deployment.ts:49-51')
  }
}

/* ------------------------------------------------------------------ */
/* Settings top level, policy, eval, executor, sources                 */
/* ------------------------------------------------------------------ */

function checkTop(raw, out) {
  const allowed = ['paused', 'sources', 'policy', 'eval', 'executor']
  for (const key of Object.keys(raw)) {
    if (!allowed.includes(key))
      out.push(diag('X001', 'error', key,
        `unknown top-level key "${key}"`,
        'SettingsSchema is strict; saving this block fails.',
        'Remove it or move it into the block that owns it.', 'src/policy.ts:99-105'))
  }
  if (raw.paused !== undefined && typeof raw.paused !== 'boolean')
    out.push(diag('X002', 'error', 'paused', 'paused must be a boolean',
      'The settings save is refused.', 'Use true or false.', 'src/policy.ts:100'))
}

function checkPolicy(raw, out) {
  if (raw.policy === undefined) return
  if (!isPlainObject(raw.policy)) {
    out.push(diag('POL000', 'error', 'policy', 'policy must be an object',
      'No rule or Source Policy can be read.', 'Use { rules, sources }.', 'src/policy.ts:79-82'))
    return
  }
  unknownKeys(out, 'POL000', 'policy', raw.policy, ['rules', 'sources'], 'src/policy.ts:79-82')

  if (raw.policy.rules !== undefined) {
    if (!Array.isArray(raw.policy.rules)) {
      out.push(diag('POL001', 'error', 'policy.rules', 'rules must be an array',
        'The whole Policy block is rejected.', 'Wrap the rules in an array.', 'src/policy.ts:80'))
    } else {
      const seen = new Map()
      raw.policy.rules.forEach((rule, index) => {
        const path = `policy.rules[${index}]`
        if (!isPlainObject(rule)) {
          out.push(diag('POL002', 'error', path, 'rule must be an object',
            'A malformed rule breaks the Policy version and the panel save.', 'Use { id, name, enabled, instruction }.', 'src/policy.ts:67-69'))
          return
        }
        unknownKeys(out, 'POL002', path, rule, ['id', 'name', 'enabled', 'instruction'], 'src/policy.ts:67-68')
        if (typeof rule.id !== 'string' || !RULE_ID_RE.test(rule.id)) {
          out.push(diag('POL003', 'error', `${path}.id`,
            'rule id must match ^[a-zA-Z0-9_-]{1,80}$',
            'Assessments reference rules by id; an invalid id makes the assessment schema unusable.',
            'Use letters, digits, "_" or "-", at most 80 characters.', 'src/policy.ts:13'))
        } else {
          const key = rule.id.toLowerCase()
          if (seen.has(key))
            out.push(diag('POL004', 'error', `${path}.id`, `duplicate rule id "${rule.id}"`,
              'Two rules share one identity; a Mandate cannot say which instruction it matched.',
              'Give each rule a unique id.', 'src/policy.ts:80'))
          seen.set(key, true)
        }
        if (typeof rule.name !== 'string' || rule.name.trim() === '' || rule.name.length > LIMITS.ruleName) {
          out.push(diag('POL005', 'error', `${path}.name`,
            `rule name must be 1..${LIMITS.ruleName} characters`,
            'The rule cannot be rendered in the prompt or panel.', 'Shorten the name.', 'src/policy.ts:67'))
        }
        if (typeof rule.instruction !== 'string' || rule.instruction.trim() === '' || rule.instruction.length > LIMITS.ruleInstruction) {
          out.push(diag('POL006', 'error', `${path}.instruction`,
            `instruction must be 1..${LIMITS.ruleInstruction} characters`,
            'The rule has no instruction for the assessor, or exceeds the prompt budget.', 'Write a concise instruction.', 'src/policy.ts:67-68'))
        }
        if (typeof rule.enabled !== 'boolean')
          out.push(diag('POL007', 'error', `${path}.enabled`, 'enabled must be a boolean',
            'The rule cannot be evaluated as on/off.', 'Use true or false.', 'src/policy.ts:67'))
      })
    }
  }

  if (raw.policy.sources !== undefined) {
    if (!isPlainObject(raw.policy.sources)) {
      out.push(diag('SRC000', 'error', 'policy.sources', 'sources must be an object',
        'No Source Policy can be read.', 'Use { "<source>": { allowed, admission } }.', 'src/policy.ts:81'))
      return
    }
    for (const [name, part] of Object.entries(raw.policy.sources)) {
      const path = `policy.sources.${name}`
      if (!SOURCE_NAME_RE.test(name))
        out.push(diag('SRC001', 'error', path, `invalid Source name "${name}"`,
          'The key cannot match a Source kind; the Policy part is unreachable.',
          'Use lowercase letters, digits and "-", starting with a letter.', 'src/policy.ts:81'))
      if (!isPlainObject(part)) {
        out.push(diag('SRC000', 'error', path, 'Source Policy must be an object',
          'The Source Policy block is rejected.', 'Use { allowed, admission }.', 'src/policy.ts:77'))
        continue
      }
      unknownKeys(out, 'SRC008', path, part, ['allowed', 'admission', 'bots'], 'src/policy.ts:77', 'info')
      checkAllowed(part.allowed, path, out)
      checkAdmission(part.admission, path, out)
      checkBots(part.bots, path, out)
    }
  }
}

function checkAllowed(allowed, path, out) {
  if (allowed === undefined) return
  if (!Array.isArray(allowed)) {
    out.push(diag('SRC002', 'error', `${path}.allowed`, 'allowed must be an array',
      'No sender list can be read; every sender is treated as unlisted.', 'Use an array of { id, name? }.', 'src/policy.ts:77'))
    return
  }
  const seen = new Map()
  allowed.forEach((entry, index) => {
    const entryPath = `${path}.allowed[${index}]`
    if (!isPlainObject(entry)) {
      out.push(diag('SRC002', 'error', entryPath, 'allowed entry must be an object',
        'The entry is skipped by the schema.', 'Use { id, name? }.', 'src/policy.ts:73,77'))
      return
    }
    unknownKeys(out, 'SRC002', entryPath, entry, ['id', 'name'], 'src/policy.ts:73')
    if (typeof entry.id !== 'string' || entry.id.trim() === '' || entry.id.length > 200) {
      out.push(diag('SRC002', 'error', `${entryPath}.id`, 'id must be 1..200 characters',
        'The sender can never match an allowed entry.', 'Use the platform user id.', 'src/policy.ts:73'))
    } else {
      const key = entry.id.toLowerCase()
      if (seen.has(key))
        out.push(diag('SRC003', 'warning', `${entryPath}.id`, `duplicate allowed entry "${entry.id}"`,
          'Membership checks use the first match; the duplicate is dead weight and hides a typo.',
          'Keep one entry per sender.', 'src/infra/text.ts:19; src/policy.ts:119-121'))
      seen.set(key, true)
    }
    if (entry.name !== undefined && (typeof entry.name !== 'string' || entry.name.length > 100))
      out.push(diag('SRC002', 'error', `${entryPath}.name`, 'name must be at most 100 characters',
        'The display name is rejected by the schema.', 'Shorten the name.', 'src/policy.ts:73'))
  })
}

function checkAdmission(admission, path, out) {
  if (admission === undefined) return
  if (!isPlainObject(admission)) {
    out.push(diag('SRC004', 'error', `${path}.admission`, 'admission must be an object',
      'The admission table is rejected; the Source falls back to defaults only if the whole block is omitted.',
      'Use { "<row>": { listedUnaddressed?, unlistedAddressed?, unlistedUnaddressed? } }.', 'src/policy.ts:75-76'))
    return
  }
  for (const [row, cells] of Object.entries(admission)) {
    const rowPath = `${path}.admission.${row}`
    if (!isPlainObject(cells)) {
      out.push(diag('SRC004', 'error', rowPath, 'admission row must be an object',
        'The row is rejected.', 'Use an object with at most three cells.', 'src/policy.ts:75'))
      continue
    }
    for (const key of Object.keys(cells)) {
      if (!ADMISSION_CELLS.includes(key))
        out.push(diag('SRC006', 'error', `${rowPath}.${key}`,
          `unknown admission cell "${key}"`,
          'The whole admission table fails strict parsing, so no cell takes effect.',
          `Use one of: ${ADMISSION_CELLS.join(', ')}.`, 'src/policy.ts:75'))
    }
    for (const cell of ADMISSION_CELLS) {
      const value = cells[cell]
      if (value === undefined) continue
      if (!ADMISSION_OPTIONS[cell].includes(value))
        out.push(diag('SRC005', 'error', `${rowPath}.${cell}`,
          `"${cell}" must be one of ${ADMISSION_OPTIONS[cell].join('|')} (got ${JSON.stringify(value)})`,
          'The admission table is rejected; the row falls back to defaults only after the whole block is removed.',
          `Use ${ADMISSION_OPTIONS[cell].join(' or ')}.`, 'src/policy.ts:75; src/admission.ts:9-10'))
    }
  }
}

function checkBots(bots, path, out) {
  if (bots === undefined) return
  if (!Array.isArray(bots)) {
    out.push(diag('SRC007', 'error', `${path}.bots`, 'bots must be an array',
      'listedBot() catches the parse error and treats the Source as having no bots, so every bot is rejected as not_human.',
      'Use an array of { id, name? }.', 'src/policy.ts:122-126'))
    return
  }
  const seen = new Set()
  bots.forEach((entry, index) => {
    const entryPath = `${path}.bots[${index}]`
    if (!isPlainObject(entry) || typeof entry.id !== 'string' || entry.id.trim() === '' || entry.id.length > 200) {
      out.push(diag('SRC007', 'error', entryPath, 'bot entry must be { id, name? } with a non-empty id',
        'The entry is not usable; that bot can never become an inferred candidate.',
        'Use the bot login, e.g. "dependabot[bot]".', 'src/policy.ts:73,122-126'))
      return
    }
    const key = entry.id.toLowerCase()
    if (seen.has(key))
      out.push(diag('SRC007', 'warning', `${entryPath}.id`, `duplicate bot entry "${entry.id}"`,
        'The duplicate has no effect.', 'Keep one entry per bot.', 'src/policy.ts:122-126'))
    seen.add(key)
  })
}

function checkEval(raw, out) {
  if (raw.eval === undefined) return
  if (!isPlainObject(raw.eval)) {
    out.push(diag('EVAL000', 'error', 'eval', 'eval must be an object',
      'The evaluation block is rejected.', 'Use { mode, timeoutSeconds, model }.', 'src/policy.ts:83-87'))
    return
  }
  unknownKeys(out, 'EVAL004', 'eval', raw.eval, ['mode', 'timeoutSeconds', 'model'], 'src/policy.ts:83-87')
  if (raw.eval.mode !== undefined && !['off', 'observe', 'auto'].includes(raw.eval.mode))
    out.push(diag('EVAL001', 'error', 'eval.mode', `mode must be off|observe|auto (got ${JSON.stringify(raw.eval.mode)})`,
      'The settings save is refused.', 'Pick one of the three modes.', 'src/policy.ts:84'))
  if (raw.eval.timeoutSeconds !== undefined)
    intInRange(out, 'EVAL002', 'eval.timeoutSeconds', raw.eval.timeoutSeconds,
      LIMITS.evalTimeoutSeconds.min, LIMITS.evalTimeoutSeconds.max, 'timeoutSeconds', 'src/policy.ts:85')
  if (raw.eval.model !== undefined && raw.eval.model !== null) checkRoleModel(raw.eval.model, 'eval.model', 'EVAL003', out)
}

function checkRoleModel(model, path, code, out) {
  const bad = !isPlainObject(model) || typeof model.provider !== 'string' || model.provider.trim() === ''
    || typeof model.model !== 'string' || model.model.trim() === ''
  if (bad) {
    out.push(diag(code, 'error', path, 'model must be { provider, model, reasoningEffort? } with non-empty strings',
      'The role model cannot be resolved; that role falls back or fails at run time.',
      'Fill provider and model, or use null for the default.', 'src/policy.ts:70-71'))
    return
  }
  unknownKeys(out, code, path, model, ['provider', 'model', 'reasoningEffort'], 'src/policy.ts:70-71')
}

function checkExecutor(raw, out) {
  if (raw.executor === undefined) return
  if (!isPlainObject(raw.executor)) {
    out.push(diag('EXE000', 'error', 'executor', 'executor must be an object',
      'The execution block is rejected.', 'Use { maxWorkers, directory, prepare, blockedCommands, model }.', 'src/policy.ts:90-97'))
    return
  }
  unknownKeys(out, 'EXE007', 'executor', raw.executor, ['model', 'maxWorkers', 'directory', 'prepare', 'blockedCommands'], 'src/policy.ts:91-97')
  if (raw.executor.maxWorkers !== undefined)
    intInRange(out, 'EXE001', 'executor.maxWorkers', raw.executor.maxWorkers,
      LIMITS.maxWorkers.min, LIMITS.maxWorkers.max, 'maxWorkers', 'src/policy.ts:93')
  if (raw.executor.directory !== undefined && (typeof raw.executor.directory !== 'string' || (raw.executor.directory !== '' && !raw.executor.directory.startsWith('/'))))
    out.push(diag('EXE002', 'error', 'executor.directory',
      `directory must be empty or an absolute path starting with "/" (got ${JSON.stringify(raw.executor.directory)})`,
      'The ticket directory cannot be resolved.', 'Use "" for <stateDir>/work or a POSIX absolute path.', 'src/policy.ts:94'))
  if (raw.executor.prepare !== undefined && (typeof raw.executor.prepare !== 'string' || raw.executor.prepare.length > LIMITS.prepareCommand))
    out.push(diag('EXE003', 'error', 'executor.prepare', `prepare must be a string of at most ${LIMITS.prepareCommand} characters`,
      'The prepare command is rejected.', 'Shorten the command.', 'src/policy.ts:95'))
  if (raw.executor.model !== undefined && raw.executor.model !== null) checkRoleModel(raw.executor.model, 'executor.model', 'EXE006', out)
  if (raw.executor.blockedCommands !== undefined) {
    if (!Array.isArray(raw.executor.blockedCommands)) {
      out.push(diag('EXE004', 'error', 'executor.blockedCommands', 'blockedCommands must be an array',
        'The execution block is rejected.', 'Use an array of command names.', 'src/policy.ts:96'))
    } else {
      const seen = new Set()
      raw.executor.blockedCommands.forEach((name, index) => {
        const path = `executor.blockedCommands[${index}]`
        if (typeof name !== 'string' || !COMMAND_RE.test(name) || name === '.' || name === '..') {
          out.push(diag('EXE004', 'error', path, `invalid command name ${JSON.stringify(name)}`,
            'The execution block is rejected.', 'Use letters, digits, ".", "_" or "-", not "." or "..".', 'src/policy.ts:88'))
        } else if (WORKER_COMMANDS.some(command => sameName(command, name))) {
          // SEM005 reports the consequence; keep one finding per problem.
        } else if (seen.has(name.toLowerCase())) {
          out.push(diag('EXE005', 'warning', path, `duplicate blocked command "${name}"`,
            'The duplicate has no effect.', 'Keep one entry per command.', 'src/policy.ts:96'))
        }
        seen.add(String(name).toLowerCase())
      })
    }
  }
}

/* ------------------------------------------------------------------ */
/* Cross-block                                                        */
/* ------------------------------------------------------------------ */

function checkCross(raw, deployment, out) {
  const policySources = isPlainObject(raw.policy) && isPlainObject(raw.policy.sources) ? raw.policy.sources : {}
  const instances = isPlainObject(raw.sources) ? raw.sources : {}
  for (const [name, instance] of Object.entries(instances)) {
    if (!isPlainObject(instance)) {
      out.push(diag('X003', 'error', `sources.${name}`, 'Source instance must be an object',
        'SourceInstanceSchema requires { enabled, config }.', 'Use { enabled, config }.', 'src/policy.ts:98'))
      continue
    }
    if (instance.enabled !== undefined && typeof instance.enabled !== 'boolean')
      out.push(diag('X003', 'error', `sources.${name}.enabled`, 'enabled must be a boolean',
        'The instance cannot be constructed.', 'Use true or false.', 'src/policy.ts:98'))
    if (instance.config !== undefined && !isPlainObject(instance.config))
      out.push(diag('X003', 'error', `sources.${name}.config`, 'config must be an object',
        'The Source kind schema cannot parse the instance.', 'Use an object.', 'src/policy.ts:98'))
  }
  if (!deployment) return
  if ('github' in policySources && (!isPlainObject(deployment.github) || !deployment.github.repository)) {
    out.push(diag('X004', 'warning', 'github',
      'a GitHub Policy exists but the deployment has no repository',
      'The GitHub Source never starts, so its allowed list and admission table are unreachable.',
      'Set github.repository and github.cli in the plugin config.', 'src/deployment.ts:87-105'))
  }
  if ('feishu' in policySources && (!isPlainObject(deployment.feishu) || !deployment.feishu.cli)) {
    out.push(diag('X005', 'warning', 'feishu',
      'a Feishu Policy exists but the deployment has no feishu.cli',
      'resolveFeishuBot returns undefined without a CLI name; the Feishu Source is not mounted.',
      'Set feishu.cli or remove the Feishu Policy part.', 'src/deployment.ts:114-119'))
  }
}

/** All structural diagnostics for one settings object and an optional deployment object. */
export function structureDiagnostics(settings, deployment) {
  const out = []
  if (!isPlainObject(settings)) {
    out.push(diag('X000', 'error', 'settings', `settings must be an object (got ${typeName(settings)})`,
      'Nothing can be validated.', 'Pass the settings object.', 'src/policy.ts:99-105'))
    return out
  }
  checkTop(settings, out)
  checkPolicy(settings, out)
  checkEval(settings, out)
  checkExecutor(settings, out)
  checkCross(settings, deployment, out)
  if (deployment !== undefined) checkDeployment(deployment, out)
  return out
}
