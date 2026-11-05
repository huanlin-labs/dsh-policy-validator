# 规则目录

共 62 条。`rules` 命令输出同一份目录；`docs/UPSTREAM.md` 给出每条的上游依据。

## 部署配置（DEP）（12）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `DEP000` | error | Deployment config is not an object |
| `DEP001` | error | stateDir missing or not an absolute POSIX path |
| `DEP002` | error | Unknown deployment key (reports where deprecated keys moved) |
| `DEP003` | error | promptMaxChars outside 1000..1000000 |
| `DEP004` | error | admissionContextMaxPages outside 1..100 |
| `DEP005` | error | admissionContextTimeoutMs outside 1..90000 |
| `DEP006` | error | sources.github.config.repository empty or not owner/name |
| `DEP007` | error | sources.github.config.cli empty |
| `DEP008` | error | Unknown sources.github.config key |
| `DEP009` | error | sources.feishu.config shape invalid |
| `DEP010` | error | github poll/observe option invalid |
| `DEP011` | error | feishu option or chat row invalid |

## 策略规则（POL）（9）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `POL000` | error | policy block shape invalid |
| `POL001` | error | rules is not an array |
| `POL002` | error | rule shape or unknown field invalid |
| `POL003` | error | rule id does not match ^[a-zA-Z0-9_-]{1,80}$ |
| `POL004` | error | Duplicate rule id |
| `POL005` | error | Rule name empty or longer than 100 characters |
| `POL006` | error | Rule instruction empty or longer than 2000 characters |
| `POL007` | error | rule.enabled is not boolean |
| `POL008` | error | Unknown policy key |

## 来源与准入（SRC）（10）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `SRC000` | error | policy.sources or a Source Policy is not an object |
| `SRC001` | error | Invalid Source name |
| `SRC002` | error | allowed entry shape or id invalid |
| `SRC003` | warning | Duplicate allowed sender |
| `SRC004` | error | admission table or row is not an object |
| `SRC005` | error | Admission cell value not allowed |
| `SRC006` | error | Unknown admission cell name |
| `SRC007` | error | bots array or bot entry invalid |
| `SRC008` | info | Unknown Source Policy key (kept by catchall, never read) |
| `SRC009` | warning | Duplicate bot entry |

## 求值（EVAL）（5）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `EVAL000` | error | eval block is not an object |
| `EVAL001` | error | eval.mode not off|observe|auto |
| `EVAL002` | error | timeoutSeconds outside 30..600 |
| `EVAL003` | error | eval.model shape invalid |
| `EVAL004` | error | Unknown eval key |

## 执行器（EXE）（8）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `EXE000` | error | executor block is not an object |
| `EXE001` | error | maxWorkers outside 1..16 |
| `EXE002` | error | directory not empty and not absolute |
| `EXE003` | error | prepare longer than 4000 characters |
| `EXE004` | error | blockedCommands shape or command name invalid |
| `EXE005` | warning | Duplicate blocked command |
| `EXE006` | error | executor.model shape invalid |
| `EXE007` | error | Unknown executor key |

## 交叉项（X）（7）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `X000` | error | settings root is not an object |
| `X001` | error | Unknown top-level settings key |
| `X002` | error | paused is not boolean |
| `X003` | error | Source instance shape invalid |
| `X004` | error | No GitHub Source instance: setup cannot resolve repository/cli |
| `X005` | warning | Feishu Policy without a usable feishu config.cli |
| `X006` | info | Unknown Source kind; config not checked |

## 语义（SEM）（11）

| 码 | 级别 | 检查内容 |
|---|---|---|
| `SEM001` | warning | accept mode off makes every enabled rule inert |
| `SEM002` | warning | auto mode with no enabled rule behaves like observe |
| `SEM003` | warning | unlisted sender can make an explicit request |
| `SEM004` | warning | Configured admission cell is never offered by that row |
| `SEM005` | error | blockedCommands contains a worker command |
| `SEM006` | warning | Service is paused |
| `SEM007` | warning | Policy targets an unknown kind or a disabled instance |
| `SEM008` | info | Admission rows without an allowed sender |
| `SEM009` | warning | Duplicate rule name |
| `SEM010` | warning | Every rule is disabled |
| `SEM011` | warning | Admission row is never produced by that Source |
