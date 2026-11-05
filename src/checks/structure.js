/**
 * Structural checks — the fallback layer.
 *
 * These mirror the zod/schemastery shapes in the upstream snapshot, but they
 * are deliberately a *subset*: the value of this tool is the semantic layer,
 * not re-implementing zod.
 *
 * Upstream references:
 *   DEP  src/deployment.ts:15-23, 31-51; src/sources/github.ts:25-28; src/sources/feishu.ts:21-29
 *   POL  src/policy.ts:13-16, 67-82
 *   SRC  src/policy.ts:73-82, src/admission.ts:9-10
 *   EVAL src/policy.ts:83-87
 *   EXE  src/policy.ts:88-97
 *   X    src/policy.ts:98-105; src/app/setup.ts:60-80
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

function unknownKeys(out, code, path, value, allowed, source, severity = 'error', override = {}) {
  for (const key of Object.keys(value)) {
    if (allowed.includes(key)) continue
    const moved = MOVED[key]
    out.push(diag(code, severity, `${path}.${key}`,
      override.message?.(key, moved) ?? `unknown key "${key}"${moved ? ` (now ${moved})` : ''}`,
      override.consequence ?? 'Upstream rejects unknown keys instead of ignoring them, so this block cannot be saved.',
      override.hint?.(key, moved) ?? (moved ? `Move it ${moved}.` : `Remove "${key}".`),
      source))
  }
}

/* ------------------------------------------------------------------ */
/* Plugin Config (deployment.json)                                     */
/* ------------------------------------------------------------------ */

const MACHINE_KEYS = ['stateDir', 'promptMaxChars', 'admissionContextMaxPages', 'admissionContextTimeoutMs']

function checkDeployment(raw, out) {
  if (!isPlainObject(raw)) {
    out.push(diag('DEP000', 'error', 'deployment',
      `deployment config must be an object (got ${typeName(raw)})`,
      'The plugin cannot read its Config; startup fails before any Source connects.',
      'Pass the object under the dsh-superagent plugin config.', 'src/deployment.ts:15-23'))
    return
  }
  unknownKeys(out, 'DEP002', 'deployment', raw, MACHINE_KEYS, 'src/deployment.ts:37-43', 'error', {
    message: (key, moved) => `unknown plugin Config key "${key}"${moved ? ` — it now lives ${moved}` : ''}`,
    consequence: 'machineOf() rejects every key the plugin Config does not use, so startup stops before the Source loads.',
    hint: (key, moved) => moved ? `Move "${key}" ${moved}; Source config belongs in settings.sources.<id>.config.` : `Remove "${key}".`,
  })

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
}

/* ------------------------------------------------------------------ */
/* Settings top level, policy, eval, executor, source instances        */
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
  if (raw.sources !== undefined && !isPlainObject(raw.sources))
    out.push(diag('X003', 'error', 'sources',
      `sources must be an object (got ${typeName(raw.sources)})`,
      'SourceInstanceSchema is a record; an array or scalar cannot hold a Source instance.',
      'Use { "<source>": { enabled, config } }.', 'src/policy.ts:101-105'))
}

function checkPolicy(raw, out) {
  if (raw.policy === undefined) return
  if (!isPlainObject(raw.policy)) {
    out.push(diag('POL000', 'error', 'policy', 'policy must be an object',
      'No rule or Source Policy can be read.', 'Use { rules, sources }.', 'src/policy.ts:79-82'))
    return
  }
  unknownKeys(out, 'POL008', 'policy', raw.policy, ['rules', 'sources'], 'src/policy.ts:79-82')

  if (raw.policy.rules !== undefined) {
    if (!Array.isArray(raw.policy.rules)) {
      out.push(diag('POL001', 'error', 'policy.rules', 'rules must be an array',
        'The whole Policy block is rejected.', 'Wrap the rules in an array.', 'src/policy.ts:80'))
    } else {
      const seen = new Set()
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
          if (seen.has(rule.id))
            out.push(diag('POL004', 'error', `${path}.id`, `duplicate rule id "${rule.id}"`,
              'Two rules share one identity; a Mandate cannot say which instruction it matched.',
              'Give each rule a unique id.', 'src/policy.ts:80'))
          seen.add(rule.id)
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
      unknownKeys(out, 'SRC008', path, part, ['allowed', 'admission', 'bots'], 'src/policy.ts:77', 'info', {
        message: key => `unknown Source Policy key "${key}" (kept by the catchall, but no engine reads it)`,
        consequence: 'SourcePolicySchema.catchall keeps this key, so it saves fine — but nothing consumes it, and it will still be part of the Policy version.',
        hint: key => `Remove "${key}" unless a Source kind documents it.`,
      })
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
      '`Array(AllowedSchema).catch([])` turns any parse error into an empty list, so every bot becomes unlisted.',
      'Use an array of { id, name? }.', 'src/policy.ts:122-126'))
    return
  }
  const seen = new Set()
  bots.forEach((entry, index) => {
    const entryPath = `${path}.bots[${index}]`
    if (!isPlainObject(entry)) {
      out.push(diag('SRC007', 'error', entryPath, 'bot entry must be { id, name? } with a non-empty id',
        '`Array(AllowedSchema).catch([])` swallows the whole list on one bad entry: every bot silently stops matching.',
        'Use the bot login, e.g. "dependabot[bot]".', 'src/policy.ts:73,122-126'))
      return
    }
    unknownKeys(out, 'SRC007', entryPath, entry, ['id', 'name'], 'src/policy.ts:73,124')
    if (typeof entry.id !== 'string' || entry.id.trim() === '' || entry.id.length > 200) {
      out.push(diag('SRC007', 'error', entryPath, 'bot entry must be { id, name? } with a non-empty id',
        'One bad entry makes zod catch the whole bots array to [], so all bots silently stop matching.',
        'Use the bot login, e.g. "dependabot[bot]".', 'src/policy.ts:73,122-126'))
      return
    }
    if (entry.name !== undefined && (typeof entry.name !== 'string' || entry.name.length > 100))
      out.push(diag('SRC007', 'error', `${entryPath}.name`, 'name must be at most 100 characters',
        'One bad name makes the whole bots array fall back to [].', 'Shorten the name.', 'src/policy.ts:73,124'))
    const key = entry.id.toLowerCase()
    if (seen.has(key))
      out.push(diag('SRC009', 'warning', `${entryPath}.id`, `duplicate bot entry "${entry.id}"`,
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
    || (model.reasoningEffort !== undefined && (typeof model.reasoningEffort !== 'string' || model.reasoningEffort.trim() === ''))
  if (bad) {
    out.push(diag(code, 'error', path, 'model must be { provider, model, reasoningEffort? } with non-empty strings',
      'The role model cannot be resolved; that role falls back or fails at run time.',
      'Fill provider and model, and make reasoningEffort a non-empty string when present.', 'src/policy.ts:70-71'))
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
  if (raw.executor.directory !== undefined) {
    const directory = typeof raw.executor.directory === 'string' ? raw.executor.directory.trim() : raw.executor.directory
    if (typeof directory !== 'string' || (directory !== '' && !directory.startsWith('/')))
      out.push(diag('EXE002', 'error', 'executor.directory',
        `directory must be empty or an absolute path starting with "/" (got ${JSON.stringify(raw.executor.directory)})`,
        'The ticket directory cannot be resolved.', 'Use "" for <stateDir>/work or a POSIX absolute path.', 'src/policy.ts:94'))
  }
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
        } else if (WORKER_COMMANDS.includes(name)) {
          // SEM005 reports the consequence; keep one finding per problem.
        } else if (seen.has(name)) {
          out.push(diag('EXE005', 'warning', path, `duplicate blocked command "${name}"`,
            'The duplicate has no effect.', 'Keep one entry per command.', 'src/policy.ts:96'))
        }
        seen.add(name)
      })
    }
  }
}

/* ------------------------------------------------------------------ */
/* Source instances and their kind-specific config                     */
/* ------------------------------------------------------------------ */

const GITHUB_CONFIG_KEYS = ['repository', 'cli', 'pollSeconds', 'failuresBeforeError', 'observeIssues', 'observePulls', 'observeComments', 'observeCi']
const FEISHU_CONFIG_KEYS = ['cli', 'readPageSize', 'linkTimeoutMs', 'chats', 'directMessages', 'otherChats']

function checkGithubConfig(config, out) {
  const path = 'sources.github.config'
  if (!isPlainObject(config)) {
    out.push(diag('DEP006', 'error', path, 'github config must be an object',
      'GithubConfigSchema.parse throws; the GitHub Source is not constructed, so setup cannot resolve the repository.',
      'Use { repository, cli, observeIssues?, ... }.', 'src/sources/github.ts:25-28'))
    return
  }
  unknownKeys(out, 'DEP008', path, config, GITHUB_CONFIG_KEYS, 'src/sources/github.ts:25-28')
  if (typeof config.repository !== 'string' || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)) {
    out.push(diag('DEP006', 'error', `${path}.repository`,
      `repository must be owner/name (got ${JSON.stringify(config.repository)})`,
      'resolveDeployment throws repositoryUnset/repositoryUnreadable; the service stays in setup.',
      'Use "owner/name", e.g. "deepseek-ai/dsh-superagent-prototype".', 'src/deployment.ts:87-105; src/sources/github.ts:25'))
  }
  if (typeof config.cli !== 'string' || config.cli.trim() === '') {
    out.push(diag('DEP007', 'error', `${path}.cli`, 'cli must be a non-empty command name or path',
      'resolveDeployment throws agentCliUnset; no GitHub account is verified.',
      'Set the gh executable name or absolute path.', 'src/deployment.ts:92-94'))
  }
  if (config.pollSeconds !== undefined)
    intInRange(out, 'DEP010', `${path}.pollSeconds`, config.pollSeconds, 60, 3600, 'pollSeconds', 'src/sources/github.ts:25')
  if (config.failuresBeforeError !== undefined)
    intInRange(out, 'DEP010', `${path}.failuresBeforeError`, config.failuresBeforeError, 1, 20, 'failuresBeforeError', 'src/sources/github.ts:26')
  for (const key of ['observeIssues', 'observePulls', 'observeComments', 'observeCi']) {
    if (config[key] !== undefined && typeof config[key] !== 'boolean')
      out.push(diag('DEP010', 'error', `${path}.${key}`, `${key} must be a boolean`,
        'GithubConfigSchema.parse throws; the Source is disabled.', 'Use true or false.', 'src/sources/github.ts:27'))
  }
}

function checkFeishuConfig(config, out) {
  const path = 'sources.feishu.config'
  if (!isPlainObject(config)) {
    out.push(diag('DEP009', 'error', path, 'feishu config must be an object',
      'FeishuConfigSchema.parse throws; the Feishu Source is left out of setup.',
      'Use { cli, chats, directMessages?, otherChats? }.', 'src/sources/feishu.ts:21-29'))
    return
  }
  unknownKeys(out, 'DEP009', path, config, FEISHU_CONFIG_KEYS, 'src/sources/feishu.ts:21-29')
  if (config.cli !== undefined && typeof config.cli !== 'string')
    out.push(diag('DEP009', 'error', `${path}.cli`, 'cli must be a string',
      'FeishuConfigSchema.parse throws.', 'Use a command name or path.', 'src/sources/feishu.ts:21'))
  if (config.readPageSize !== undefined)
    intInRange(out, 'DEP011', `${path}.readPageSize`, config.readPageSize, 1, 50, 'readPageSize', 'src/sources/feishu.ts:22')
  if (config.linkTimeoutMs !== undefined)
    intInRange(out, 'DEP011', `${path}.linkTimeoutMs`, config.linkTimeoutMs, 1, 90000, 'linkTimeoutMs', 'src/sources/feishu.ts:23')
  if (config.directMessages !== undefined && typeof config.directMessages !== 'boolean')
    out.push(diag('DEP011', 'error', `${path}.directMessages`, 'directMessages must be a boolean',
      'FeishuConfigSchema.parse throws.', 'Use true or false.', 'src/sources/feishu.ts:27'))
  if (config.otherChats !== undefined && !['none', 'mentions'].includes(config.otherChats))
    out.push(diag('DEP011', 'error', `${path}.otherChats`, 'otherChats must be none|mentions',
      'FeishuConfigSchema.parse throws.', 'Use "none" or "mentions".', 'src/sources/feishu.ts:28'))
  if (config.chats !== undefined) {
    if (!Array.isArray(config.chats)) {
      out.push(diag('DEP011', 'error', `${path}.chats`, 'chats must be an array',
        'FeishuConfigSchema.parse throws.', 'Use an array of { chatId, listen }.', 'src/sources/feishu.ts:24'))
    } else {
      const seen = new Set()
      config.chats.forEach((chat, index) => {
        const chatPath = `${path}.chats[${index}]`
        if (!isPlainObject(chat)) {
          out.push(diag('DEP011', 'error', chatPath, 'chat must be { chatId, name?, listen }',
            'FeishuConfigSchema.parse throws.', 'Use an object.', 'src/sources/feishu.ts:24'))
          return
        }
        unknownKeys(out, 'DEP011', chatPath, chat, ['chatId', 'name', 'listen'], 'src/sources/feishu.ts:24')
        if (typeof chat.chatId !== 'string' || !/^oc_[a-zA-Z0-9]+$/.test(chat.chatId))
          out.push(diag('DEP011', 'error', `${chatPath}.chatId`, 'chatId must match ^oc_[a-zA-Z0-9]+$',
            'FeishuConfigSchema.parse throws.', 'Use the chat open id.', 'src/sources/feishu.ts:24'))
        else if (seen.has(chat.chatId))
          out.push(diag('DEP011', 'error', `${chatPath}.chatId`, `duplicate chat id "${chat.chatId}"`,
            'The zod refine rejects duplicate chat ids.', 'Keep one row per chat.', 'src/sources/feishu.ts:24-25'))
        seen.add(chat.chatId)
        if (chat.listen !== 'mentions' && chat.listen !== 'all')
          out.push(diag('DEP011', 'error', `${chatPath}.listen`, 'listen must be mentions|all',
            'FeishuConfigSchema.parse throws.', 'Use "mentions" or "all".', 'src/sources/feishu.ts:24'))
        if (chat.name !== undefined && (typeof chat.name !== 'string' || chat.name.length > 60))
          out.push(diag('DEP011', 'error', `${chatPath}.name`, 'name must be at most 60 characters',
            'FeishuConfigSchema.parse throws.', 'Shorten the name.', 'src/sources/feishu.ts:24'))
      })
    }
  }
}

function checkSourceInstances(raw, out) {
  if (!isPlainObject(raw.sources)) return
  for (const [name, instance] of Object.entries(raw.sources)) {
    const path = `sources.${name}`
    if (!SOURCE_NAME_RE.test(name))
      out.push(diag('X003', 'error', path, `invalid Source instance name "${name}"`,
        'SourceInstanceSchema keys must match ^[a-z][a-z0-9-]*$; the save is refused.',
        'Use lowercase letters, digits and "-", starting with a letter.', 'src/policy.ts:101'))
    if (!isPlainObject(instance)) {
      out.push(diag('X003', 'error', path, 'Source instance must be an object',
        'SourceInstanceSchema requires { enabled, config }.', 'Use { enabled, config }.', 'src/policy.ts:98'))
      continue
    }
    unknownKeys(out, 'X003', path, instance, ['enabled', 'config'], 'src/policy.ts:98')
    if (instance.enabled !== undefined && typeof instance.enabled !== 'boolean')
      out.push(diag('X003', 'error', `${path}.enabled`, 'enabled must be a boolean',
        'The instance cannot be constructed.', 'Use true or false.', 'src/policy.ts:98'))
    if (name === 'github') checkGithubConfig(instance.config, out)
    else if (name === 'feishu') checkFeishuConfig(instance.config, out)
    else out.push(diag('X006', 'info', `${path}.config`,
      `unknown Source kind "${name}"; its config was not checked`,
      'Only github and feishu are known in this snapshot; another plugin may register this kind.',
      'Check the kind name if you expected schema validation here.', 'src/sources/registry.ts'))
  }
}

/* ------------------------------------------------------------------ */
/* Cross-block                                                        */
/* ------------------------------------------------------------------ */

function checkCross(raw, out) {
  if (!isPlainObject(raw.sources) || !Object.hasOwn(raw.sources, 'github')) {
    out.push(diag('X004', 'error', 'sources.github',
      'no GitHub Source instance: setup resolves repository and cli from settings.sources.github.config',
      'resolveDeployment is called with undefined and throws repositoryUnset; the service never leaves setup.',
      'Add sources.github with { enabled: true, config: { repository: "owner/name", cli: "gh" } }.',
      'src/app/setup.ts:76-85; src/deployment.ts:87-94'))
  }
  const sources = isPlainObject(raw.policy) && isPlainObject(raw.policy.sources) ? raw.policy.sources : {}
  if ('feishu' in sources) {
    const config = isPlainObject(raw.sources) && isPlainObject(raw.sources.feishu) ? raw.sources.feishu.config : undefined
    const cli = isPlainObject(config) ? config.cli : undefined
    if (!isPlainObject(raw.sources) || !Object.hasOwn(raw.sources, 'feishu') || typeof cli !== 'string' || cli.trim() === '')
      out.push(diag('X005', 'warning', 'feishu',
        'a Feishu Policy exists but the deployment has no usable feishu config.cli',
        'resolveFeishuBot fails and setup leaves Feishu out; its Policy part is unreachable.',
        'Set sources.feishu.config.cli or remove the Feishu Policy part.', 'src/app/setup.ts:80-85'))
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
  checkSourceInstances(settings, out)
  checkCross(settings, out)
  if (deployment !== undefined) checkDeployment(deployment, out)
  return out
}
