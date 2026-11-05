# Architecture

```mermaid
flowchart TD
  S[settings.json<br/>policy · eval · executor · sources] --> N[model.js<br/>normalise defaults]
  D[deployment.json<br/>4 machine keys only] --> N
  N --> K[kinds.js<br/>GitHub/Feishu rows + cells]
  N --> ST[checks/structure.js<br/>DEP · POL · SRC · EVAL · EXE · X]
  N --> SEM[checks/semantic.js<br/>SEM001–SEM011]
  K --> SEM
  K --> M[matrix.js<br/>admission matrix]
  ST --> R[report.js<br/>sort · dedupe · exit code]
  SEM --> R
  R --> OUT[check --format text|json]
  N --> V[version.js<br/>canonical policy + sha256]
  V --> VOUT[version / --compare]
  M --> MOUT[matrix]
```

The important split is **shape vs meaning**:

- `structure.js` mirrors the zod/schemastery shapes. It is a fallback for CI and
  for readers who do not want to install the plugin.
- `semantic.js` encodes docs/002 authorization semantics that no schema can
  express: an `off` mode that makes rules inert, an `explicit` cell that
  disables the allow-list, a configured cell the row never offers, and a
  Policy version change that invalidates Mandates.
- `kinds.js` is the projection of `SourceKind.policy.rows(stored)`: GitHub
  exposes `issues/pulls/comments/ci`; Feishu exposes one row per configured
  chat plus `other` and `direct`. Availability matters — a cell the row never
  offers is dead even if its value is legal.
