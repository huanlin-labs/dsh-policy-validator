# dsh-superagent Policy 静态校验器

> 在把 `settings.json` 粘进面板之前，离线看清：**这份 Policy 会让谁获得授权、哪些规则会静默失效、策略版本一变哪些 Mandate 会失守。**

零依赖、纯 Node ESM、不联网、不启动服务。所有判断都基于 `dsh-superagent-prototype` 的 2026-10-31 快照（`POLICY_REVISION="mandate-v3"`）。

## 为什么不是又一个 JSON Schema 校验器

上游本身用 zod 校验形状：字段类型不对、未知键、越界值，面板保存时就会拒绝。真正会伤人的是**形状合法但语义不符预期**的配置：

| 你以为 | 实际 |
|---|---|
| 写了 3 条规则，agent 会主动接活 | `eval.mode="off"`，inferred 候选永不产生，规则全是摆设 |
| 只允许白名单里的人 | 某行 `unlistedAddressed="explicit"`，任何人 @ 一下就能开工 |
| 这个群只收 @ 消息，但配了未 @ 的准入格 | 那一格永远收不到消息，配了等于没配 |
| 禁掉 `gh` 更安全 | 上游 schema 直接拒绝——worker 没 `gh` 就跑不了 Ticket |
| 改一条规则文案没关系 | `policyVersion` 变了，所有 inferred Mandate 在 resume 时要重新过 `auto` + 规则启用检查 |

这个工具就盯这些。形状校验只做兜底，不跟 zod 抢活。

## 快速开始

需要 Node ≥ 20（本机实测 24.18）。

```bash
# 1) 合法配置：0 条 error，退出码 0
node src/cli.js check --settings examples/valid/settings.json --deployment examples/valid/deployment.json

# 2) 含错配置：4 条发现，退出码 1
node src/cli.js check --settings examples/invalid/settings.json --deployment examples/invalid/deployment.json

# 3) 准入矩阵：谁会被放行
node src/cli.js matrix --settings examples/valid/settings.json
```

第 3 条的输出：

```text
source: github
  row                     listed/unaddressed    unlisted/addressed    unlisted/unaddressed
  issue                   inferred (config)     ignore (default)      ignore (default)
  pull_request            inferred (config)     ignore (default)      ignore (default)

A listed sender who addresses the agent is always explicit and does not read an admission cell (src/policy.ts:197).
```

## 命令

| 命令 | 作用 | 关键参数 |
|---|---|---|
| `check` | 校验 settings（可选 deployment），输出诊断 | `--settings`（必填）、`--deployment`、`--format text\|json`、`--strict`、`--max-warnings N` |
| `matrix` | 展开每个 source / 每个 admission row 的三格有效值 | `--settings`、`--format` |
| `version` | 打印 `mandate-v3` 内容哈希；`--compare` 比较两份配置的授权影响 | `--settings`、`--compare`、`--expect` |
| `rules` | 列出 56 条诊断码 | `--format` |

退出码：

- `0`：没有 error（warning / info 不阻断）
- `1`：有 error；`--strict` 下 warning 也算；`--max-warnings` 超预算也算；`--expect` 哈希不符也算
- `2`：参数错误、文件不存在、JSON 解析失败

`check --format json` 的 stdout 是**纯 JSON**，日志只走 stderr，方便接 CI。

## 诊断长什么样

```json
{
  "code": "SEM003",
  "severity": "warning",
  "path": "policy.sources.github.admission.issue.unlistedAddressed",
  "message": "anyone in this scope can make an explicit request by mentioning the agent",
  "consequence": "The allowed list stops protecting this scope: an unlisted sender becomes an explicit request, works in every accept mode, and can start a Ticket.",
  "hint": "Keep \"explicit\" only for a dedicated support chat you actually want open to everyone; otherwise use \"inferred\" or \"ignore\".",
  "source": "docs/002-authorization.md:56-73"
}
```

`consequence` 是刻意加的：只说“格式不对”没有用，要说清“这条改完会发生什么”。

## 语义检查（SEM）

| 码 | 级别 | 触发条件 | 后果 |
|---|---|---|---|
| SEM001 | warning | `mode=off` 且有启用规则 | inferred 永不产生，规则全是摆设 |
| SEM002 | warning | `mode=auto` 但无启用规则 | `admitsInferred` 要求至少一条规则，auto 等同 observe |
| SEM003 | warning | 任一 `unlistedAddressed=explicit` | 该 scope 的白名单失效，任何人 @ 即开工 |
| SEM004 | warning | 配了未 @ 单元格，但该 scope 只收 @ 消息 | 该格永远收不到消息 |
| SEM005 | error | `blockedCommands` 含 `gh`/`git`/`lark-cli` | 上游直接拒绝整份配置 |
| SEM006 | warning | `paused=true` | 服务暂停，其余 Policy 全部闲置 |
| SEM007 | warning | policy source 无实例或实例 disabled | 整块 Policy 不可达 |
| SEM008 | info | 有 admission 行但 allowed 为空 | 只剩 unlisted 路径，listed 快捷方式永不生效 |
| SEM009 | warning | 规则 name 重复 | 评估按 id 记录，但面板/提示词按 name，审计困难 |
| SEM010 | warning | 所有规则都 disabled | accept 永远 `noRuleMatched` |

结构检查（DEP/POL/SRC/EVAL/EXE/X，共 46 条）见 [`docs/RULES.md`](docs/RULES.md)；每条的上游文件与行号见 [`docs/UPSTREAM.md`](docs/UPSTREAM.md)。

## 策略版本

`version` 复刻上游 `src/policy.ts:116-118`：

```text
key(POLICY_REVISION, JSON.stringify({ rules, mode, sources }))
= sha256(JSON.stringify([...])).slice(0, 32)
```

因此 `paused`、模型、`maxWorkers` 变化**不会**改哈希；`rules` / `eval.mode` / `policy.sources` 任一变化**会**。`--compare` 额外给出影响面：离开 `auto` 会让所有 inferred Mandate 失守，删/禁规则会让匹配它的 Mandate 失守，删 source 会让该来源的 Mandate 无法重验证。

> 注意：哈希对键序敏感。这里按 zod 输出的键序做了规范化（rule 为 `id,name,enabled,instruction`；source 为 `allowed,admission,...`），标准形状下与上游一致；如果你的配置带自定义 catchall 字段，请用 `version` 打印的值做自比对，不要跨工具比。

## fixtures 与测试

- `fixtures/cases/`：34 个用例，每个含 `settings.json`、`deployment.json`、`expected.json`（退出码 + 诊断码）。
- 覆盖：3 个正例、部署 9 类、策略 6 类、来源 8 类、求值 3 类、执行器 4 类、交叉 3 类、语义 10 类、组合场景。
- `node --test`：62 个测试，含规则单测、fixtures 快照、CLI 端到端（4 个子命令 + 3 种退出码）。
- `node scripts/check-fixtures.mjs`：单独核对全部 fixtures。
- `node scripts/gen-fixtures.mjs`：重建 fixtures（改规则后先跑这个再核对）。
- `node scripts/gen-docs.mjs`：从 `src/catalog.js` 重建 `docs/UPSTREAM.md` 与 `docs/RULES.md`。

## 目录

```text
src/
  model.js              上游常量、默认展开
  report.js             诊断模型、稳定排序、退出码
  matrix.js             admission 矩阵
  version.js            key() / policyVersion / comparePolicies
  catalog.js            56 条诊断码目录
  checks/semantic.js    SEM001–SEM010
  checks/structure.js   DEP/POL/SRC/EVAL/EXE/X
  index.js              对外 API（validate）
  cli.js                CLI
fixtures/cases/          34 个用例
test/                   62 个测试
docs/                   UPSTREAM / RULES / PRIOR-ART
scripts/                生成与核对脚本
```

## 它不做什么

- **不启动服务、不连 GitHub / 飞书**：所有输入都是本地 JSON。
- **不验证登录态**：`gh auth status`、`lark-cli auth status` 这类只能联网/带账号做的事，一律降级为 warning/info 并写明原因。
- **不替代 zod**：结构校验是兜底，不是逐字节等价；zod 才是保存时的最后一道门。
- **不判断运行时行为**：Eval 超时、投递、重试、面板交互都不在范围内。
- **不做自动修复**：只给 `hint`，不擅自改配置。

## 快照与时间盒

- 上游：`deepseek-ai/dsh-superagent-prototype`，2026-10-31 发布，`POLICY_REVISION="mandate-v3"`。
- 先例调查：2026-11-05，未发现同类的离线 Policy 校验器；详见 [`docs/PRIOR-ART.md`](docs/PRIOR-ART.md)。
- 时间盒：8 小时；实际从 14:31 开始，代码、fixtures、测试、文档在 1 小时内完成，剩余时间用于补边界用例与文档校对。

上游日更。升级快照时按这个顺序复核：`src/policy.ts` 的 schema 与常量 → `src/limits.ts` → `src/admission.ts` → 本文档的 SEM 表 → `scripts/gen-docs.mjs` 的 `SOURCES` 映射。

## License

代码 MIT。`src/model.js` 中的常量与默认规则文本来自 MIT 许可的上游快照，仅用于兼容性校验。
