# fixtures

每个用例一个目录，固定三件：

```text
<编号>-<短名>/
  settings.json      dsh-superagent Settings（policy / eval / executor / sources / paused）
  deployment.json    插件 Config（stateDir / promptMaxChars / github / feishu ...）
  expected.json      { "exitCode": 0|1, "codes": ["SEM001", ...] }
```

约定：

1. `codes` 是**去重后的集合**，顺序无关；测试会排序后比较。
2. `exitCode` 只反映默认模式（不加 `--strict`）：有 error 为 1，否则 0。
3. 一个用例可以触发多个码；不要为了“一个用例一个码”拆碎，真实的错误经常是成组出现的。
4. 新增用例后跑 `node scripts/check-fixtures.mjs`，它会把实际输出与 `expected.json` 对齐。
5. 修改规则后先跑 `node scripts/gen-fixtures.mjs` 重建，再人工核对 `expected.json` 是否仍然表达你的意图——生成器不会替你判断语义。

覆盖要求（`test/fixtures.test.js` 会强制）：

- 用例数 ≥ 30；
- `src/catalog.js` 里的每一个码至少被一个用例触发；
- 每个用例的诊断码集合与 `expected.json` 完全一致。

当前 34 个用例，56 个码全部覆盖。
