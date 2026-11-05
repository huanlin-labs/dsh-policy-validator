# 先例调查（2026-11-05）

## 结论

截至 2026-11-05，**公开可检索范围内未发现**「dsh-superagent Policy 静态校验器」的现成实现（检索式与盲区见文末）。这个位置是空的，但上游已经提供了**运行时**校验，立项时必须避开重复。

## 检索方法

- GitHub 仓库搜索（名称 / 描述 / README，按 star 排序）：`dsh-superagent`、`dsh-superagent policy`、`validator`、`lint`、`check`、`doctor`、`policy editor`、`superagent-policy`、`superagent admission`、`dsh policy gate`。
- GitHub API 仓库元数据：官方仓的创建时间、star、fork、push 时间。
- npm registry 搜索 `dsh-superagent`（registry 响应超时，未作为结论依据）。
- 本地源码核对：`scripts/dsh-superagent` 的子命令、`tests/policy.spec.ts`、`src/sources/registry.ts` 的 `validatePolicy`。
- 通用先例：`microsoft/Agent-Policy-Author` 的 README 与定位。

## 发现

### 1. 上游：有运行时校验，没有离线 CLI

[T1] `deepseek-ai/dsh-superagent-prototype`，2026-10-31 创建，18,898 star / 2,122 fork（2026-11-05 查询），MIT。

- `src/policy.ts` 用 zod 定义 `SettingsSchema`，保存设置时校验形状。
- `src/sources/registry.ts` 的 `validatePolicy` 把每个 Source 的 Policy 片段交给对应 kind 的 schema，admission 由共享 schema 校验。
- `tests/policy.spec.ts` 有 40 个策略用例，覆盖 gate、revalidation、版本、迁移。
- `scripts/dsh-superagent` 只有 `start / stop / restart / status` 四个子命令，没有 `validate` / `check`。
- 结论：**形状错误在面板保存或服务启动时会被拦；语义错误（mode 与规则冲突、admission 与接收范围冲突、版本影响面）没有静态入口。**

### 2. 生态：五天里长出一圈周边，没有校验器

GitHub 搜索 `dsh-superagent` 返回 479 个仓库（2026-11-05 的 GitHub API 查询；该数字会随时间变化）。抽样核对名称与描述：

- `Check-mj/dsh-superagent-windows`：Windows 移植 + 桌面应用 + Watchdog。
- `deepseekv41flash/dsh-superagent-panel`：多实例管理面板。
- `lesterppo/dsh-superagent-rs`：Rust 复刻，含 `policy gate`，但是运行时实现。
- `miyako-sa/dsh-superagent-telegram`：Telegram Source。
- `shishuai2016/multiple-superagents`：多实例运维 skills。
- `lahavi/awesome-superagent`：资源列表，Security 段只列文档与新闻。
- `WINwin0215/superagent-sandbox`、`liufangzhilang/superagent-sandbox`：端到端测试沙盒，不是配置校验。

搜索 `validator` / `lint` / `check` / `doctor` / `policy editor` 均无对口项目。

### 3. 通用先例：路线不同

[T1] `microsoft/Agent-Policy-Author`（2026-10-27 最后 push，1 star）：从应用源码发现 agent 动作 → 生成规范策略 → 行为测试 → 编译到 OPA / Cedar / Cerbos / ACS。

它解决的是「给一个应用生成可执行授权策略」，不校验 dsh-superagent 的 `settings` 形状，也不认识 admission 三格与 `mandate-v3`。可借鉴的是「canonical policy + 行为测试 + 人工审阅证据」的结构，不是代码。

## 对作品的影响

1. **不做**「又一个 JSON Schema 校验器」：上游 zod 已经做了，重复没有价值。
2. **主攻**语义层：`mode=off` 的静默失效、`unlistedAddressed=explicit` 的开放性、接收范围与未 @ 单元格的矛盾、`blockedCommands` 禁用 worker 命令、`policyVersion` 漂移后的 Mandate 影响面。
3. **保留**结构校验作为兜底，但定位为「CI 里不装 zod 也能先看一眼」。
4. **锁定快照**：上游 5 天前才发布，规则随时会漂。所有诊断码在 `docs/UPSTREAM.md` 标注文件与行号，README 写明 `mandate-v3` 与 2026-10-31。

## 局限

GitHub 只能搜仓库名 / 描述 / README；代码级搜索需要登录。私有仓库、未索引的 gist、以及发布在聊天群里的脚本不在覆盖范围内。因此结论应表述为「公开可检索范围内未发现」，而不是「绝对没有人做」。

## 来源

- [T1|https://github.com/deepseek-ai/dsh-superagent-prototype|访问 2026-11-05]
- [T1|https://github.com/microsoft/Agent-Policy-Author|访问 2026-11-05]
- [T1|https://github.com/lesterppo/dsh-superagent-rs|访问 2026-11-05]
- [T1|https://github.com/Check-mj/dsh-superagent-windows|访问 2026-11-05]
- [T1|https://github.com/deepseekv41flash/dsh-superagent-panel|访问 2026-11-05]
- [T1|https://github.com/lahavi/awesome-superagent|访问 2026-11-05]
