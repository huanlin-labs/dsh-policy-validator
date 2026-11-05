# fixtures

每个用例一个目录，固定三件：

```text
<编号>-<短名>/
  settings.json     dsh-superagent Settings（policy / eval / executor / sources）
  deployment.json   插件 Config（stateDir / promptMaxChars / admissionContext*）
  expected.json      { exitCode, codes, diagnostics }
```

约定：

1. `codes` 是去重后的集合，顺序无关。
2. `diagnostics` 是**逐条快照**（`code`、`severity`、`path`），`test/fixtures.test.js` 与
   `scripts/check-fixtures.mjs` 都会 `deepEqual`；只改码集合而不改快照会让测试失败。
3. `exitCode` 只反映默认模式（不加 `--strict`）：有 error 为 1，否则 0。
4. 一个用例可以触发多个码；重复码（如两条 X003）靠 `diagnostics` 的条数保证，不会被去重掩盖。
5. 新增用例后跑 `node scripts/check-fixtures.mjs`；改规则后先跑 `node scripts/gen-fixtures.mjs`，再人工核对 `expected.json` 是否仍表达你的意图——生成器只记录现状，不替你判断语义。

覆盖要求（`test/fixtures.test.js` 会强制）：

- 用例数 ≥ 30；
- `src/catalog.js` 里的每一个码至少被一个用例触发；
- 每个用例的码集合、逐条诊断快照与退出码都与 `expected.json` 完全一致。

当前 47 个用例，62 个码全部覆盖。
