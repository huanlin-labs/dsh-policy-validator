/**
 * Generate docs/UPSTREAM.md and docs/RULES.md from the catalog.
 * Run after changing a diagnostic code: node scripts/gen-docs.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOG } from '../src/catalog.js'

const here = dirname(fileURLToPath(import.meta.url))
const docs = join(here, '..', 'docs')
mkdirSync(docs, { recursive: true })

const SOURCES = {
  DEP000: 'src/deployment.ts:15-23', DEP001: 'src/deployment.ts:13,16,38-42', DEP002: 'src/deployment.ts:31-43',
  DEP003: 'src/deployment.ts:17', DEP004: 'src/deployment.ts:19', DEP005: 'src/deployment.ts:21',
  DEP006: 'src/deployment.ts:46,87-105', DEP007: 'src/deployment.ts:92-94', DEP008: 'src/deployment.ts:45-51',
  DEP009: 'src/deployment.ts:49-51',
  POL000: 'src/policy.ts:79-82', POL001: 'src/policy.ts:80', POL002: 'src/policy.ts:67-69',
  POL003: 'src/policy.ts:13', POL004: 'src/policy.ts:80', POL005: 'src/policy.ts:67',
  POL006: 'src/policy.ts:67-68', POL007: 'src/policy.ts:67',
  SRC000: 'src/policy.ts:77-81', SRC001: 'src/policy.ts:81', SRC002: 'src/policy.ts:73,77',
  SRC003: 'src/policy.ts:119-121; src/infra/text.ts:19', SRC004: 'src/policy.ts:75-76',
  SRC005: 'src/policy.ts:75; src/admission.ts:9-10', SRC006: 'src/policy.ts:75',
  SRC007: 'src/policy.ts:122-126', SRC008: 'src/policy.ts:77 (catchall)',
  EVAL000: 'src/policy.ts:83-87', EVAL001: 'src/policy.ts:84', EVAL002: 'src/policy.ts:85',
  EVAL003: 'src/policy.ts:70-71,86', EVAL004: 'src/policy.ts:83-87',
  EXE000: 'src/policy.ts:90-97', EXE001: 'src/policy.ts:93', EXE002: 'src/policy.ts:94',
  EXE003: 'src/policy.ts:95', EXE004: 'src/policy.ts:88,96', EXE005: 'src/policy.ts:96',
  EXE006: 'src/policy.ts:70-71,92', EXE007: 'src/policy.ts:91-97',
  X000: 'src/policy.ts:99-105', X001: 'src/policy.ts:99-105', X002: 'src/policy.ts:100',
  X003: 'src/policy.ts:98', X004: 'src/deployment.ts:87-105', X005: 'src/deployment.ts:114-119',
  SEM001: 'src/policy.ts:55-58,184; docs/002-authorization.md:91-99',
  SEM002: 'src/policy.ts:212', SEM003: 'docs/002-authorization.md:56-73',
  SEM004: 'docs/002-authorization.md:63-71; src/policy.ts:199-201',
  SEM005: 'src/policy.ts:88-89; src/infra/environment.ts:18', SEM006: 'src/policy.ts:190',
  SEM007: 'src/policy.ts:99-105; docs/002-authorization.md:119-121',
  SEM008: 'docs/002-authorization.md:56-71', SEM009: 'src/policy.ts:63-68', SEM010: 'src/policy.ts:41-52',
}

const missing = CATALOG.filter(item => !SOURCES[item.code]).map(item => item.code)
if (missing.length) throw new Error(`missing source mapping: ${missing.join(', ')}`)

const header = `# 上游依据

快照：\`deepseek-ai/dsh-superagent-prototype\`，2026-10-31 发布，\`POLICY_REVISION="mandate-v3"\`。
本地复核路径：\`E:\\资料库\\前沿科技\\DeepSeek-SuperAgent-2026-10\\源码\\dsh-superagent-prototype\`。

上游日更。**升级快照前必须重新核对本表**：行号会漂移，语义也可能变。

| 码 | 级别 | 类 | 检查内容 | 上游依据 |
|---|---|---|---|---|
`
const rows = CATALOG.map(item => `| \`${item.code}\` | ${item.severity} | ${item.category} | ${item.title} | \`${SOURCES[item.code]}\` |`)
writeFileSync(join(docs, 'UPSTREAM.md'), header + rows.join('\n') + '\n')

const groups = ['deployment', 'policy', 'source', 'eval', 'executor', 'cross', 'semantic']
const names = { deployment: '部署配置（DEP）', policy: '策略规则（POL）', source: '来源与准入（SRC）', eval: '求值（EVAL）', executor: '执行器（EXE）', cross: '交叉项（X）', semantic: '语义（SEM）' }
const lines = ['# 规则目录', '', `共 ${CATALOG.length} 条。\`rules\` 命令输出同一份目录；\`docs/UPSTREAM.md\` 给出每条的上游依据。`, '']
for (const group of groups) {
  const items = CATALOG.filter(item => item.category === group)
  lines.push(`## ${names[group]}（${items.length}）`, '', '| 码 | 级别 | 检查内容 |', '|---|---|---|')
  for (const item of items) lines.push(`| \`${item.code}\` | ${item.severity} | ${item.title} |`)
  lines.push('')
}
writeFileSync(join(docs, 'RULES.md'), lines.join('\n'))
console.log(`wrote docs/UPSTREAM.md and docs/RULES.md (${CATALOG.length} codes)`)
