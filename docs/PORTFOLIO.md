# 作品说明：dsh-superagent Policy 静态校验器

> 一句话：在把配置粘进面板之前，离线回答“这份 Policy 到底会放行谁、哪些规则会静默失效、改一版会让哪些 Mandate 失守”。

- 角色：独立完成（调研、设计、实现、测试、文档）
- 时间：2026-11-05，约 8 小时时间盒
- 形态：零依赖 Node CLI，离线运行，不启动服务
- 代码：本仓库

## 问题

`dsh-superagent` 的 `settings.json` 决定三件事：谁能让 Agent 开工（admission）、它能主动接什么活（rules + eval mode）、活怎么跑（executor）。上游用 zod 校验形状，但**形状合法不等于按预期工作**：

- `eval.mode="off"` 时规则全部失效，配置看起来却很正常；
- 某行 `unlistedAddressed="explicit"` 会让白名单失效，任何人 @ 一下就能开工；
- 准入行写成 `issue`，而 GitHub Source 实际产生的是 `issues`，这一行永远不出现；
- 改一条规则文案会改变 `policyVersion`，让所有 inferred Mandate 在 resume 时重新过校验。

这些都是“保存成功、上线才出事”的问题，需要在提交前有一个静态入口。

## 做法

三层，语义优先：

1. **结构兜底**（51 码）：对照上游 zod / schemastery 校验部署配置、Policy、Source 实例、执行器。
2. **语义层**（11 码，SEM001–SEM011）：编码 docs/002 的授权语义——mode 与规则冲突、explicit 单元格、行不提供该格、worker 命令被禁、paused、版本影响面。
3. **投影层**：按 Source kind 展开准入矩阵（GitHub `issues/pulls/comments/ci`；Feishu 每个 chat + `other` + `direct`），并复刻上游 `policyVersion` 哈希。

CLI 四个命令：`check`、`matrix`、`version`（含 `--compare`）、`rules`。退出码 0/1/2，`--format json` 的 stdout 是纯 JSON。

## 结果

- 62 条诊断码；47 个 fixtures，覆盖全部码；85 个 `node:test` 测试。
- `examples/valid` 退出码 0；`examples/invalid` 退出码 1（1 error + 3 warning）。
- 零运行时依赖，`node src/cli.js` 直接跑，CI 不需要 `npm install`。
- 三路独立审查（代码 / QA / 可投递性）发现 3 个 P0（deployment 位置错误、null Source Policy 崩溃、准入行未按 kind 投影）与全部 P1，修复后复核关闭；记录见 `docs/REVIEW.md`。

## 可复现

```bash
cd dsh-policy-validator
npm test
node scripts/check-fixtures.mjs
npm run demo
```

## 面试可讲的三点

1. **先调查再动手**：先确认上游已有 zod，避免做成“又一个 schema 校验器”；差异化放在语义层。
2. **先对齐上游事实**：`github`/`feishu` 在 `settings.sources.*.config` 而不是插件 Config；GitHub 行 id 是 `issues/pulls/comments/ci`；这类事实错误会被面试官当场问穿，所以逐条写了 `docs/UPSTREAM.md`。
3. **测试要能失败**：fixtures 不只比码集合，还快照每条诊断的 `code/severity/path`；`--strict`、`--expect`、BOM、null 输入都有回归测试。

## 边界

- 不验证登录态、不联网、不启动服务；凭据问题只在运行时暴露。
- 不替代上游 zod；结构校验是兜底，不是逐字节等价。
- 快照锁定 `mandate-v3`（2026-10-31），上游日更后需按 `docs/UPSTREAM.md` 复核行号。
