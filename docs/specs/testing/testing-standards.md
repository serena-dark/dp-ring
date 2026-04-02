# 测试规范

本目录为测试流程、用例与报告约定入口。

**本仓库约定**：自动化测试默认由仓库根的 **`npm test`** 触发，实现为 [cli-tool/run-tests.mjs](../../../cli-tool/run-tests.mjs)（Node 原生 `node:test`，无参时匹配 `tests/**/*.test.mjs`）。

> 待完善：覆盖率门槛、与 CI 的进一步集成。
