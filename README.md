# dsh-superagent Policy 静态校验器

> 把 `settings.json` 粘进面板之前，离线看清：**这份 Policy 会让谁获得授权、哪些规则会静默失效、策略版本一变哪些 Mandate 会失守。**

作者：吴昭睿 · 2026-11-05 · v0.1.0 · Node ≥ 20 · 83 tests passing

**English abstract.** An offline, zero-dependency linter for `dsh-superagent` policies. Upstream zod already rejects malformed settings at save time; this tool targets the semantic failures it cannot see — `mode=off` making rules inert, an `explicit` admission cell disabling the allow-list, an admission cell the Source row never offers, and a policy-version change that invalidates live Mandates. It also projects the admission matrix and reproduces the upstream policy hash.

## 目录

- [它解决什么问题](#它解决什么问题)
- [快速开始](#快速开始)
- [命令](#命令)
- [诊断码](#诊断码)
- [准入矩阵](#准入矩阵)
- [策略版本与影响面](#策略版本与影响面)
- [deployment 与 settings 的分工](#deployment-与-settings-的分工)
- [fixtures 与测试](#fixtures-与测试)
- [设计取舍](#设计取舍)
- [它不做什么](#它不做什么)
- [快照与许可](#快照与许可)

## 它解决什么问题

`dsh-superagent` 是 DeepSeek 的常驻编码 Agent。它的 `settings.json` 决定三件事：谁能让它开工（admission）、它能主动接什么活（rules + eval mode）、活怎么跑（executor）。上游用 zod 校验形状，形状错误在保存时就会被拒绝——但下面这些配置**形状完全合法**：

| 你以为 | 实际 |
|---|---|
| 写了 3 条规则，Agent 会主动接活 | `eval.mode="off"`，inferred 候选永不产生，规则全是摆设 |
| 只允许白名单里的人 | 某行 `unlistedAddressed="explicit"`，任何人 @ 一下就能开工 |
| 这个群只收 @ 消息，但配了未 @ 的准入格 | 该行根本不提供那个格子，配了等于没配 |
| 行名写成 `issue` | GitHub Source 产生的是 `issues`，这一行永远不会出现 |
| 禁掉 `gh` 更安全 | 上游直接拒绝整份配置——worker 没 `gh` 就跑不了 Ticket |
| 改一条规则文案没关系 | `policyVersion` 变了，所有 inferred Mandate 在 resume 时要重新过 `auto` + 规则启用检查 |

这个工具就盯这些。结构校验只做兜底，不跟 zod 抢活。

## 快速开始

需要 Node ≥ 20（本机实测 24.18）。

```bash
# 1) 合法配置：0 条 error，退出码 0
node src/cli.js check --settings examples/valid/settings.json --deployment examples/valid/deployment.json

# 2) 含错配置：1 条 error + 3 条 warning，退出码 1
node src/cli.js check --settings examples/invalid/settings.json --deployment examples/invalid/deployment.json

# 3) 准入矩阵：谁会被放行
node src/cli.js matrix --settings examples/valid/settings.json
```

第 3 条会列出 GitHub 的 `issues / pulls / comments / ci` 四行、`<default>` 行，以及每格是配置值还是默认值；`x` 表示该行不提供这一格。

## 命令

| 命令 | 作用 | 参数 |
|---|---|---|
| `check` | 校验 settings（可选 deployment），输出诊断 | `--settings`（必填）、`--deployment`、`--format text\|json`、`--strict`、`--max-warnings N`、`--expect <hash>` |
| `matrix` | 展开每个 source 的准入行与三格有效值 | `--settings`、`--format` |
| `version` | 打印 `mandate-v3` 内容哈希；`--compare` 比较两份配置的授权影响 | `--settings`、`--compare`、`--expect` |
| `rules` | 列出 62 条诊断码 | `--format` |

退出码：

- `0`：没有 error；warning / info 不阻断
- `1`：有 error；`--strict` 下 warning 也算；`--max-warnings` 超预算也算；`--expect` 哈希不符也算
- `2`：参数错误、文件不存在、JSON 解析失败、`--format` 非法

`check --format json` 的 stdout 是**纯 JSON**，诊断与错误信息只走 stderr。报告里的 `inputs.settings` 是解析后的绝对路径，同一文件在不同 cwd 下得到同一份 JSON。

`--expect` 的正确用法：

```bash
node src/cli.js check --settings settings.json --deployment deployment.json \
  --format json --expect d54ad3d321d6995db10cd73992427aa2
```

不匹配时报告里 `expectation.match=false`、`ok=false`，退出码 1。

## 诊断码

共 **62 条**：51 条结构（DEP 12 / POL 9 / SRC 10 / EVAL 5 / EXE 8 / X 7）+ 11 条语义（SEM001–SEM011）。完整目录见 [`docs/RULES.md`](docs/RULES.md)，每条的上游文件与行号见 [`docs/UPSTREAM.md`](docs/UPSTREAM.md)。

所有诊断的 `source` 都以 `upstream:` 开头，指向上游仓库的 `src/`（例如 `upstream:src/policy.ts:197`）；**本仓库没有 `src/policy.ts`**，不要把 `upstream:` 后面的路径当成本仓库文件。

语义检查是最有价值的部分：

| 码 | 级别 | 触发条件 | 后果 |
|---|---|---|---|
| SEM001 | warning | `mode=off` 且有启用规则 | inferred 永不产生，规则全是摆设 |
| SEM002 | warning | `mode=auto` 但无启用规则 | `admitsInferred` 要求至少一条规则，auto 等同 observe |
| SEM003 | warning | 任一 `unlistedAddressed=explicit` | 该 scope 的白名单失效，任何人 @ 即开工 |
| SEM004 | warning | 配了该行**不提供**的准入格 | 值再合法也不影响任何 Trigger |
| SEM005 | error | `blockedCommands` 含 `gh`/`git`/`lark-cli`（精确匹配） | 上游直接拒绝整份配置 |
| SEM006 | warning | `paused=true` | 服务暂停，其余 Policy 全部闲置 |
| SEM007 | warning | Policy 指向未知 kind，或实例 `enabled=false` | 整块 Policy 不可达 |
| SEM008 | info | 有 admission 行但 `allowed` 为空 | 只剩 unlisted 路径，listed 快捷方式永不生效 |
| SEM009 | warning | 规则 name 重复（忽略大小写） | 面板与提示词按 name 展示，审计困难 |
| SEM010 | warning | 所有规则都 disabled | accept 永远 `noRuleMatched` |
| SEM011 | warning | admission 行名不是该 Source kind 产生的 id | 该行永远不会成为 Trigger |

## 准入矩阵

`matrix` 不是把 `admission` 原样打印，而是按 Source kind 投影：

- **GitHub**：`issues`、`pulls`、`comments`、`ci` 四行。`observeIssues/Pulls/Comments/Ci` 决定该行是否提供未 @ 的两格；`ci` 只提供 `unlistedUnaddressed`。
- **Feishu**：`config.chats` 里每个 `chatId` 一行，外加 `other` 与 `direct`。`listen="all"` 的群提供未 @ 两格；`otherChats="mentions"` 决定 `other` 行；`directMessages` 决定 `direct` 行。
- **`<default>`**：始终显示三格的全局默认（`inferred / ignore / ignore`）。

一个列在 `allowed` 里的人直接 @ Agent，永远是 explicit，不读任何格子（`src/policy.ts:197`）。

## 策略版本与影响面

`version` 复刻上游 `src/policy.ts:116-118`：

```text
key(POLICY_REVISION, JSON.stringify({ rules, mode, sources }))
= sha256(JSON.stringify([...])).slice(0, 32)
```

因此 `paused`、模型、`maxWorkers` 变化**不会**改哈希；`rules` / `eval.mode` / `policy.sources` 任一变化**会**。`--compare` 额外给出影响面：

- 离开 `auto` ⇒ `INFERRED_MANDATES_LOSE_AUTO`（所有 inferred Mandate 失守）
- 删/禁规则 ⇒ `MANDATES_LOSE_RULE`（匹配它的 Mandate 失守）
- 删 source ⇒ `MANDATES_LOSE_SOURCE`（该来源的 Mandate 无法重验证）

## deployment 与 settings 的分工

这是最容易配错的地方，本工具按上游实际读取位置校验：

| 内容 | 位置 |
|---|---|
| 插件 Config（`deployment.json`） | 只有 `stateDir`、`promptMaxChars`、`admissionContextMaxPages`、`admissionContextTimeoutMs` |
| GitHub 仓库与 CLI | `settings.sources.github.config.repository` / `.cli` |
| Feishu CLI 与群 | `settings.sources.feishu.config.*` |

上游 `src/app/setup.ts:76-85` 把 `settings.sources.github?.config` 传给 `resolveDeployment`；把 `github` 写进插件 Config 会被 `machineOf` 以 "configuration has keys it does not use" 拒绝（`src/deployment.ts:38-42`）。`DEP002` 会明确提示迁移到 Source。

## fixtures 与测试

- `fixtures/cases/`：47 个用例，每个含 `settings.json`、`deployment.json`、`expected.json`。
- `expected.json` 记录退出码、码集合，以及 **每条诊断的 code/severity/path 快照**；测试逐条 `deepEqual`，不是只比码集合。
- 覆盖：每个 catalog 码至少被一个用例触发；`test/fixtures.test.js` 强制检查。
- `node --test`：83 个测试（规则单测、47 个 fixture 快照、API 冒烟、CLI 端到端）。
- `node scripts/check-fixtures.mjs`：单独核对全部 fixtures。
- `node scripts/gen-fixtures.mjs`：重建 fixtures（改规则后先跑这个，再核对 `expected.json` 的意图）。
- `node scripts/gen-docs.mjs`：从 `src/catalog.js` 重建 `docs/UPSTREAM.md` 与 `docs/RULES.md`。

## 目录

```text
src/
  model.js              上游常量、默认展开
  kinds.js              GitHub/Feishu 的准入行投影
  report.js             诊断模型、稳定排序、退出码
  matrix.js             准入矩阵
  version.js            key() / policyVersion / comparePolicies
  catalog.js            62 条诊断码目录
  checks/semantic.js    SEM001–SEM011
  checks/structure.js   DEP/POL/SRC/EVAL/EXE/X
  index.js              对外 API（validate）
  cli.js                CLI
fixtures/cases/          47 个用例
test/                   83 个测试
docs/                   UPSTREAM / RULES / ARCHITECTURE / PRIOR-ART
scripts/                生成与核对脚本
```

架构图见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)。

## 设计取舍

1. **语义优先，schema 兜底**：形状错误上游 zod 已经拦；本工具的价值在“形状合法但语义不符预期”。
2. **零依赖**：只用 Node 标准库，CI 里 `node src/cli.js` 即可跑，不需要 `npm install`。
3. **稳定输出**：诊断按 severity → path → code 排序，去重键为 code+path+message；比较用 code unit，不用受 locale 影响的 `localeCompare`。
4. **不猜运行态**：不联网、不调用 `gh` / `lark-cli`、不启动服务；所有结论只来自两份 JSON。
5. **快照明确**：所有上游引用都是相对仓库的 `src/...:行号`，并锁定 `mandate-v3`。

## 它不做什么

- **不验证登录态**：本工具不执行 `gh auth status` 或 `lark-cli auth status`；凭据问题只在运行时暴露。
- **不替代 zod**：结构校验是兜底，不是逐字节等价；保存时的最后一道门仍是上游。
- **不判断运行时行为**：Eval 超时、投递、重试、面板交互都不在范围内。
- **不做自动修复**：只给 `hint`，不擅自改配置。

## 快照与许可

- 上游：`deepseek-ai/dsh-superagent-prototype`，2026-10-31 发布，`POLICY_REVISION="mandate-v3"`。
- 先例调查：2026-11-05，公开可检索范围内未发现同类的离线 Policy 校验器；检索式与盲区见 [`docs/PRIOR-ART.md`](docs/PRIOR-ART.md)。
- 许可证：MIT（见 [`LICENSE`](LICENSE)）。复用上游常量与默认规则文本的部分在 [`NOTICE`](NOTICE) 中注明上游 MIT 与快照日期。
- 变更记录：[`CHANGELOG.md`](CHANGELOG.md)。提交前审查：[`docs/REVIEW.md`](docs/REVIEW.md)（三路独立审查与复核结论）。

上游日更。升级快照时按这个顺序复核：`src/policy.ts` 的 schema 与常量 → `src/deployment.ts` → `src/sources/github.ts` / `feishu.ts` 的 `policy.rows()` → `docs/UPSTREAM.md` 的映射 → `scripts/gen-docs.mjs` 的 `SOURCES`。
