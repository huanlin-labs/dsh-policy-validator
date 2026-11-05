# Changelog

## 0.1.0 — 2026-11-05

- First release.
- CLI: `check`, `matrix`, `version`, `rules`; text and JSON output; exit codes 0/1/2.
- 62 diagnostic codes: 51 structural (DEP/POL/SRC/EVAL/EXE/X) + 11 semantic (SEM001–SEM011).
- Admission matrix projected from the Source kind: GitHub `issues/pulls/comments/ci`;
  Feishu configured chats plus `other` and `direct`.
- `version --compare` reports policy-version changes and Mandate impact.
- 47 fixtures covering every catalog code; 85 `node:test` tests.
- `npm run demo` runs the four scenarios end to end.
- Zero runtime dependencies; Node ≥ 20.
