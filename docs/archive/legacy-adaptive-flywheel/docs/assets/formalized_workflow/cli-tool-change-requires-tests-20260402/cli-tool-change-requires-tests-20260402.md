# 工作流 · CLI 变更与测试门禁（正式化）

> Archived asset: 本文档沉淀的是旧 `cli-tool` 文档流中的正式化工作流，仅作历史经验参考。

本工作流把「动 `cli-tool`」与「测什么、怎么算收工」绑成固定门禁：改动可执行入口或生成逻辑时，必须留下 `tests/` 里的自动化用例，并在合并前用 `npm test` 复跑通过。读者为改 CLI 的人与审 PR 的人；与仓库其它命名、会话规则独立，仅引用相关入口文档。

---

## 摘要表

| 键 | 值 |
| --- | --- |
| **读者** | 修改或评审 `cli-tool` 的开发者与 Agent。 |
| **约定** | 测试目录与命名见 [repository-layout.md](../../../../../repository-layout.md)；仓库级测试约定入口见 [testing-standards.md](../../../specs/testing/testing-standards.md)（持续补全）。与「如何敲命令、命名规则」无矛盾：仍服从 [documentation-standards.md](../../../../../documentation-standards.md) 与 [cli-tool/README.md](../../../../../cli-tool/README.md) **治理原则**。 |

---

## 适用范围

| 算「本工作流覆盖」 | 不算（但评审可要求补测） |
| --- | --- |
| 新建 `cli-tool/*.mjs` 入口脚本 | 纯文档、`docs/` 正文-only 变更 |
| 修改 `cli-tool/lib/*.mjs` 被 CLI 或文档生成依赖的逻辑 | 仅改 `README` 错别字且行为未变 |
| 改模板占位符、生成路径、参数解析等**可观测行为** | — |

---

## 必须做的事（顺序）

1. **写或改测试**  
   - 优先：`tests/cli-tool/` 下 `*.test.mjs`，用 Node 自带 `node:test`；CLI 推荐**子进程调用真实入口**（与生产一致）。  
   - 若逻辑在 `lib/` 且适合单测，可再加针对性用例（仍建议至少保留一条 CLI 级冒烟/集成路径）。  
2. **跑通**  
   - 在仓库根目录执行 **`npm test`**（即 [run-tests.mjs](../../../../cli-tool/run-tests.mjs)；无参跑全量，也可 `node cli-tool/run-tests.mjs <文件或 glob>` 跑子集），**须全部通过**后再视为改动完成。  
   - 合并/Gate 前在干净环境中**再跑一遍**同一命令，确认非「本地脏状态」偶然通过。  

---

## 反例（禁止）

- 只改 `cli-tool`、手写「我本地试过」而不提交测试。  
- 测试写在 `cli-tool/` 内随脚本删除而丢失（测试代码默认放在 `tests/`）。  
- 省略 `npm test`（或不等价的 [run-tests](../../../../cli-tool/run-tests.mjs) 调用），仅在 PR 描述中声称「已验证」。  
- 在 CI/文档里再写一套与 `npm test` 不同的 `node --test` glob（入口须统一为 `run-tests.mjs`）。  

**说明**：不要用另一个 `*.test.mjs` 在测试运行器**内部**再嵌套启动完整 `node --test`（Node 会视作递归并跳过）；对 `run-tests` 本身的覆盖靠仓库根执行 `npm test` 即已真实跑到该脚本。

---

## 参考

- [cli-tool/README.md](../../../../../cli-tool/README.md)（治理原则 · 文档同步）  
- [doc-cli-scaffold-chain-20260402.md](../doc-cli-scaffold-chain-20260402/doc-cli-scaffold-chain-20260402.md)（脚手架与命令顺序）  
- 现有范例：`tests/cli-tool/generate-markdown.integration.test.mjs`
