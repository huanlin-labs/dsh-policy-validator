---
name: dsh-policy-validator
description: "Offline pre-flight for dsh-superagent settings.json and deployment.json: catch semantic failures zod cannot see (mode=off, explicit admission cells, dead rows, banned worker commands, policyVersion impact). | 离线校验 dsh-superagent Policy：在粘贴进面板前发现 zod 看不出的语义错误。"
version: "0.1.0"
user-invocable: true
allowed-tools: Read, Bash
---

# dsh-policy-validator

Use this skill when the user asks to validate a **dsh-superagent** Policy or deployment config, inspect an admission matrix, or explain why a config change would invalidate Mandates.

This is a **DSH Skill** that wraps a zero-dependency Node CLI. It is not a Cordis native plugin and does not install a background service.

## Install

```bash
git clone https://github.com/huanlin-labs/dsh-policy-validator.git ~/.dsh/skills/dsh-policy-validator
```

The skill directory contains `src/cli.js`; no `npm install` is needed.

## Commands

Set `SKILL_DIR` to the directory that contains this `SKILL.md` (for example `~/.dsh/skills/dsh-policy-validator`).

Validate a settings/deployment pair:

```bash
node "$SKILL_DIR/src/cli.js" check \
  --settings <settings.json> \
  --deployment <deployment.json>
```

Print the admission matrix:

```bash
node "$SKILL_DIR/src/cli.js" matrix --settings <settings.json>
```

Print the policy version and compare two configs:

```bash
node "$SKILL_DIR/src/cli.js" version --settings <settings.json>
node "$SKILL_DIR/src/cli.js" version --settings <old.json> --compare <new.json>
```

Exit codes: `0` no error, `1` findings, `2` usage/JSON error. Add `--format json` for machine-readable output; stdout stays pure JSON.

## What it checks

- 62 diagnostic codes: 51 structural (DEP/POL/SRC/EVAL/EXE/X) + 11 semantic (SEM001–SEM011).
- `mode=off` makes rules inert; `unlistedAddressed=explicit` disables the allow-list; an admission row the Source never produces is dead; banned worker commands are rejected upstream; a policy-version change invalidates inferred Mandates.
- The admission matrix is projected from the Source kind: GitHub `issues/pulls/comments/ci`; Feishu configured chats plus `other` and `direct`.

## Rules for the agent

1. Never edit the user's settings/deployment files unless explicitly asked; this skill is read-only by default.
2. Report the code, severity, path, consequence and hint; do not invent findings.
3. If the user asks why a finding matters, cite `docs/RULES.md` and `docs/UPSTREAM.md`.
4. If the CLI exits `2`, show the stderr message and stop; do not guess a corrected config.

## Limits

- No network access, no API key, no `gh` / `lark-cli` login check.
- It does not replace the upstream zod validation; it catches semantic failures after the shape is valid.
- Snapshot: upstream `deepseek-ai/dsh-superagent-prototype`, 2026-10-31, `POLICY_REVISION="mandate-v3"`.
