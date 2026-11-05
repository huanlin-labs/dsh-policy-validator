# 操作指南：在粘贴配置前抓住 dsh-superagent 的静默失效

> 面向正在配置 `dsh-superagent` 的 operator。目标不是再写一个 schema 校验器，而是回答一个 zod 回答不了的问题：**这份配置保存成功之后，到底会放行谁、哪些规则会静默失效、改一版会让哪些 Mandate 失守？**

## 为什么形状校验不够

`dsh-superagent` 用 zod 校验 `settings.json` 和 `deployment.json` 的形状，这能挡住类型错误、缺失字段和越界值。但它挡不住“形状合法、语义错了”的配置：

1. `eval.mode="off"`：规则仍然存在、仍然通过校验，但运行时全部不生效。
2. 某个准入行写了 `unlistedAddressed="explicit"`：白名单失效，任何人 @ 一下就能开工。
3. 准入行写成 `issue`，而 GitHub Source 实际产生的是 `issues`：这一行永远不会出现，配置看起来却完全正常。
4. 改一条规则文案会改变 `policyVersion`，让所有 inferred Mandate 在 resume 时重新过校验。

这些问题的共同点是：**保存成功，上线才出事**。它们需要一个在提交前运行的静态入口。

## 安装

```bash
git clone https://github.com/huanlin-labs/dsh-policy-validator.git \
  ~/.dsh/skills/dsh-policy-validator
```

零依赖，不需要 `npm install`。`SKILL.md` 在仓库根，DSH 会把它当作一个 Skill 发现。

## 三个最常用的命令

### 1. 校验一对配置

```bash
node ~/.dsh/skills/dsh-policy-validator/src/cli.js check \
  --settings ~/.dsh/superagent/settings.json \
  --deployment ~/.dsh/superagent/deployment.json
```

退出码：`0` 无错误，`1` 有发现，`2` 用法/JSON 错误。加 `--format json` 时 stdout 是纯 JSON，方便接 CI。

### 2. 看准入矩阵

```bash
node ~/.dsh/skills/dsh-policy-validator/src/cli.js matrix \
  --settings ~/.dsh/superagent/settings.json
```

矩阵按 Source kind 投影：GitHub 是 `issues/pulls/comments/ci`；Feishu 是每个配置的 chat，再加 `other` 和 `direct`。每个单元格会标出 value、来源、是否可用、是否允许。不可用的格子就是“死格”，往里填配置不会生效。

### 3. 看 policyVersion 影响面

```bash
node ~/.dsh/skills/dsh-policy-validator/src/cli.js version \
  --settings old.json --compare new.json
```

它会复刻上游的 `policyVersion` 哈希，并告诉你哪些 inferred Mandate 会因版本变化而需要重新校验。改规则文案前先跑一次，比事后补 Mandate 便宜。

## 输出怎么读

每条诊断包含：`code`、`severity`、`path`、`message`、`hint`。先看 `severity=error`，再看 `warning`。不要只看条数：一条 SEM004（配置了不可用的准入格）往往比十条格式警告更严重。

常见码：

| 码 | 含义 |
| --- | --- |
| SEM001 | `eval.mode="off"` 导致规则全部失效 |
| SEM004 | 某个准入格配置了值，但该 Source 永远不会产生这一格 |
| SEM011 | 准入行永远不会被产生（例如 GitHub 写成 `issue`） |
| DEP002 | `github` / `feishu` 被放进了错误的位置（应在 `settings.sources.*.config`） |
| POL005 | 规则名或指令在 trim 后为空 |

完整目录见 `docs/RULES.md`。

## 放进 CI

```bash
node src/cli.js check \
  --settings config/settings.json \
  --deployment config/deployment.json \
  --format json > policy-report.json
```

`check` 的退出码可以直接当 CI 门禁。配置仓库里建议把 `examples/valid` 和 `examples/invalid` 都跑一遍，确认工具本身没有漂移。

## 边界

- 只读本地两个 JSON：不联网、不需要 API Key、不执行 shell。
- 不替代上游 zod；它补的是形状合法之后的语义层。
- 快照基于 `deepseek-ai/dsh-superagent-prototype` 2026-10-31，`POLICY_REVISION="mandate-v3"`；上游改版后需要重新核对行号与常量。
- 这是 DSH Skill + CLI，不是 Cordis 原生插件，不会注册后台服务。

## 反馈

仓库：https://github.com/huanlin-labs/dsh-policy-validator

如果它帮你抓到过一次“保存成功但上线出事”的配置，欢迎在仓库开 issue，或到 DSH 的 `Show Your Plugins!` 讨论区交流。
