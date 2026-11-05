# 提交前审查记录（2026-11-05）

三路只读审查，全部由独立会话执行，互不共享上下文；发现问题后由主会话修复，原审查员复核同一批问题。

## 范围

| 审查 | 关注点 | 结论 |
|---|---|---|
| 代码审计 | 对照上游 `policy.ts` / `deployment.ts` / `github.ts` / `feishu.ts` 的语义、默认值、边界输入 | 3 个 P0、5 个 P1 全部关闭 |
| QA 审计 | 实际运行四个命令、对抗输入、退出码、纯 JSON、fixture 假绿、cwd | 1 个 P0、5 个 P1 全部关闭；12/12 复核 PASS |
| 可投递性审计 | README 数字、命令可跑、先例调查、边界声明、提交件 | 2 个 P0、6 个 P1 全部关闭；最终 3 项复核 PASS |

## 修复的关键问题

1. **deployment 位置错误**：`github` / `feishu` 曾被当作插件 Config 顶层键；上游实际从 `settings.sources.<id>.config` 读取。已改为 4 个机器键，Source 配置移入 settings，并在 `DEP002` 给出迁移提示。
2. **null Source Policy 崩溃**：`policy.sources.github = null` 曾触发 TypeError；现在返回 `SRC000`，CLI 仍输出 JSON。
3. **准入投影不认识 Source kind**：曾把 `issue` 当合法行；现在 GitHub 投影 `issues/pulls/comments/ci`，Feishu 投影 `chats + other + direct`，新增 `SEM004`（格子不可用）与 `SEM011`（行不会被产生）。
4. **fixture 假绿**：`expected.json` 现在保存每条诊断的 `code/severity/path` 快照，测试逐条 `deepEqual`，重复码靠条数保证。
5. **CLI 契约**：`--strict=true`、`--compare --expect`、`--max-warnings ""`、BOM、未知 flag、`version/matrix` 的 null 输入、`--expect` 的 `ok` 字段、绝对路径输入，均已修正并有回归测试。
6. **文档真实性**：删除“工具会检查 gh/lark-cli 登录态”的不实描述；fixture 分类数字改为实际值；`source` 统一加 `upstream:` 前缀；LICENSE / NOTICE / CHANGELOG 补齐。

## 复核结论

- 代码审计：`PASS ×6，仍 FAIL 的 P0/P1：无`；`node --test` 83/83，`check-fixtures` 47/47。
- QA 审计：`12/12 PASS，原 P0/P1 全部关闭`。
- 可投递性审计：`4/5/6 三条残留修复后 PASS`，`47/47`、`83/83`。

## 已知限制（不阻断提交）

- 未在 Node 20 实跑，只在 Node 24.18 验证；代码静态检查未使用 Node 20 之后的 API。
- 没有终端截图或 GIF；架构图用 Mermaid 文本代替。
- 作品当前位于工作区仓库的子目录，不是独立 git 仓库；提交时可按目录打包或抽成独立 repo。
- 上游日更；所有行号对应 2026-10-31 快照，升级后需按 `docs/UPSTREAM.md` 复核。
