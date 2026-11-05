# 上游依据

快照：[`deepseek-ai/dsh-superagent-prototype`](https://github.com/deepseek-ai/dsh-superagent-prototype)，2026-10-31 发布，`POLICY_REVISION="mandate-v3"`。
所有行号均指该公开仓库的 `src/` 文件；本仓库自己的 `src/` 是校验器实现，不是上游。

上游日更。**升级快照前必须重新核对本表**：行号会漂移，语义也可能变。

| 码 | 级别 | 类 | 检查内容 | 上游依据 |
|---|---|---|---|---|
| `DEP000` | error | deployment | Deployment config is not an object | `src/deployment.ts:15-23` |
| `DEP001` | error | deployment | stateDir missing or not an absolute POSIX path | `src/deployment.ts:13,16,38-42` |
| `DEP002` | error | deployment | Unknown deployment key (reports where deprecated keys moved) | `src/deployment.ts:31-43` |
| `DEP003` | error | deployment | promptMaxChars outside 1000..1000000 | `src/deployment.ts:17` |
| `DEP004` | error | deployment | admissionContextMaxPages outside 1..100 | `src/deployment.ts:19` |
| `DEP005` | error | deployment | admissionContextTimeoutMs outside 1..90000 | `src/deployment.ts:21` |
| `DEP006` | error | deployment | sources.github.config.repository empty or not owner/name | `src/deployment.ts:46,87-105` |
| `DEP007` | error | deployment | sources.github.config.cli empty | `src/deployment.ts:92-94` |
| `DEP008` | error | deployment | Unknown sources.github.config key | `src/deployment.ts:45-51` |
| `DEP009` | error | deployment | sources.feishu.config shape invalid | `src/deployment.ts:49-51` |
| `DEP010` | error | deployment | github poll/observe option invalid | `src/sources/github.ts:25-27` |
| `DEP011` | error | deployment | feishu option or chat row invalid | `src/sources/feishu.ts:21-29` |
| `POL000` | error | policy | policy block shape invalid | `src/policy.ts:79-82` |
| `POL001` | error | policy | rules is not an array | `src/policy.ts:80` |
| `POL002` | error | policy | rule shape or unknown field invalid | `src/policy.ts:67-69` |
| `POL003` | error | policy | rule id does not match ^[a-zA-Z0-9_-]{1,80}$ | `src/policy.ts:13` |
| `POL004` | error | policy | Duplicate rule id | `src/policy.ts:80` |
| `POL005` | error | policy | Rule name empty or longer than 100 characters | `src/policy.ts:67` |
| `POL006` | error | policy | Rule instruction empty or longer than 2000 characters | `src/policy.ts:67-68` |
| `POL007` | error | policy | rule.enabled is not boolean | `src/policy.ts:67` |
| `POL008` | error | policy | Unknown policy key | `src/policy.ts:79-82` |
| `SRC000` | error | source | policy.sources or a Source Policy is not an object | `src/policy.ts:77-81` |
| `SRC001` | error | source | Invalid Source name | `src/policy.ts:81` |
| `SRC002` | error | source | allowed entry shape or id invalid | `src/policy.ts:73,77` |
| `SRC003` | warning | source | Duplicate allowed sender | `src/policy.ts:119-121; src/infra/text.ts:19` |
| `SRC004` | error | source | admission table or row is not an object | `src/policy.ts:75-76` |
| `SRC005` | error | source | Admission cell value not allowed | `src/policy.ts:75; src/admission.ts:9-10` |
| `SRC006` | error | source | Unknown admission cell name | `src/policy.ts:75` |
| `SRC007` | error | source | bots array or bot entry invalid | `src/policy.ts:122-126` |
| `SRC008` | info | source | Unknown Source Policy key (kept by catchall, never read) | `src/policy.ts:77 (catchall)` |
| `SRC009` | warning | source | Duplicate bot entry | `src/policy.ts:122-126` |
| `EVAL000` | error | eval | eval block is not an object | `src/policy.ts:83-87` |
| `EVAL001` | error | eval | eval.mode not off|observe|auto | `src/policy.ts:84` |
| `EVAL002` | error | eval | timeoutSeconds outside 30..600 | `src/policy.ts:85` |
| `EVAL003` | error | eval | eval.model shape invalid | `src/policy.ts:70-71,86` |
| `EVAL004` | error | eval | Unknown eval key | `src/policy.ts:83-87` |
| `EXE000` | error | executor | executor block is not an object | `src/policy.ts:90-97` |
| `EXE001` | error | executor | maxWorkers outside 1..16 | `src/policy.ts:93` |
| `EXE002` | error | executor | directory not empty and not absolute | `src/policy.ts:94` |
| `EXE003` | error | executor | prepare longer than 4000 characters | `src/policy.ts:95` |
| `EXE004` | error | executor | blockedCommands shape or command name invalid | `src/policy.ts:88,96` |
| `EXE005` | warning | executor | Duplicate blocked command | `src/policy.ts:96` |
| `EXE006` | error | executor | executor.model shape invalid | `src/policy.ts:70-71,92` |
| `EXE007` | error | executor | Unknown executor key | `src/policy.ts:91-97` |
| `X000` | error | cross | settings root is not an object | `src/policy.ts:99-105` |
| `X001` | error | cross | Unknown top-level settings key | `src/policy.ts:99-105` |
| `X002` | error | cross | paused is not boolean | `src/policy.ts:100` |
| `X003` | error | cross | Source instance shape invalid | `src/policy.ts:98` |
| `X004` | error | cross | No GitHub Source instance: setup cannot resolve repository/cli | `src/app/setup.ts:76-94` |
| `X005` | warning | cross | Feishu Policy without a usable feishu config.cli | `src/app/setup.ts:80-85` |
| `X006` | info | cross | Unknown Source kind; config not checked | `src/sources/registry.ts` |
| `SEM001` | warning | semantic | accept mode off makes every enabled rule inert | `src/policy.ts:55-58,184; docs/002-authorization.md:91-99` |
| `SEM002` | warning | semantic | auto mode with no enabled rule behaves like observe | `src/policy.ts:212` |
| `SEM003` | warning | semantic | unlisted sender can make an explicit request | `docs/002-authorization.md:56-73` |
| `SEM004` | warning | semantic | Configured admission cell is never offered by that row | `docs/002-authorization.md:63-71; src/policy.ts:199-201` |
| `SEM005` | error | semantic | blockedCommands contains a worker command | `src/policy.ts:88-89; src/infra/environment.ts:18` |
| `SEM006` | warning | semantic | Service is paused | `src/policy.ts:190` |
| `SEM007` | warning | semantic | Policy targets an unknown kind or a disabled instance | `src/policy.ts:99-105; docs/002-authorization.md:119-121` |
| `SEM008` | info | semantic | Admission rows without an allowed sender | `docs/002-authorization.md:56-71` |
| `SEM009` | warning | semantic | Duplicate rule name | `src/policy.ts:63-68` |
| `SEM010` | warning | semantic | Every rule is disabled | `src/policy.ts:41-52` |
| `SEM011` | warning | semantic | Admission row is never produced by that Source | `src/sources/github.ts:80-90; src/sources/feishu.ts:90-101` |
