# cli-tool · 仓库命令行工具

本目录存放与本仓库运维、文档工作流相关的**独立命令行工具**说明；面向需要在本地生成规范化路径名与 Markdown 初稿的开发者。**`session_id` 语义**见 [docs/sessions/sessions.md](../docs/sessions/sessions.md)；命名与 Markdown 规则见 [documentation-standards.md](../docs/documentation-standards.md)。**新增或修改工具前须阅读下文「治理原则」并完成自检。**

---

## 治理原则（新增工具必读）

1. **先查复用**  
   加新脚本前，确认现有工具或 `npm` 脚本、编辑器能力是否已覆盖。

2. **工具之间相互独立**  
   每个 CLI 文件不 `spawn` 另一个 CLI；共享逻辑放在 `lib/*.mjs`（库不是用户入口）。

3. **`session_id` 必须模块复用**  
   任何代码（含未来 `src/`）若需生成与规范一致的 **`session_id` 字面值**（贯穿执行与归档等载体），须 `import { buildSessionArchiveBasename, … } from '…/cli-tool/lib/session-id.mjs'`，禁止复制实现。

4. **普通文档基名必须模块复用**  
   须 `import { computeDocBasename } from '…/cli-tool/lib/doc-basename.mjs'`；`generate-markdown` 已遵守，**不要在别处手写 `r1-`/`t1w1-` 拼串**。

5. **最小独立功能**  
   一 CLI 一事：`generate-session-id` 只打印 **`session_id`** 字面值；`generate-doc-basename` 只打其它基名；`generate-markdown` 只负责「模板 + 调用 doc-basename 写文件」；`run-tests` 只在仓库根汇总执行 `node --test`（**`npm test` 须调用此入口**，勿在多处手写不同 glob）。

6. **文档同步**  
   新工具或新模板：更新本文件与 [documentation-standards.md](../docs/documentation-standards.md) / [repository-layout.md](../docs/repository-layout.md)。

> 待完善：何时将工具升格为 npm 独立包、与 CI 的调用约定。

---

## 工具清单

| 工具 | 职责 | npm |
| --- | --- | --- |
| [generate-session-id.mjs](./generate-session-id.mjs) | **`session_id` 推荐字面值**（三段式；可选建 `docs/sessions/archive/<basename>/`） | `generate-session-id` |
| [generate-doc-basename.mjs](./generate-doc-basename.mjs) | 打印非 Session 基名（含 `milestone` + `--requirement-package`）；可选 `--mkdir` | `generate-doc-basename` |
| [generate-markdown.mjs](./generate-markdown.mjs) | 用 [templates/](./templates/) 生成 requirement / milestone / prerequisites / task / workflow / feedback 文件 | `generate-markdown` |
| [run-tests.mjs](./run-tests.mjs) | 默认跑 `tests/**/*.test.mjs`；可传文件或 glob；`--` 后参数交给 `node` | `test`（`npm test`） |
| [lib/session-id.mjs](./lib/session-id.mjs) | **可编程** `session_id` 字面值（CLI 与此同源） | （import） |
| [lib/doc-basename.mjs](./lib/doc-basename.mjs) | **可编程** 其它文档基名 | （import） |
| [lib/naming-shared.mjs](./lib/naming-shared.mjs) | 序号扫描、name slug | （import） |

---

## 使用示例

```bash
npm run generate-session-id -- --name "archive handoff" --mkdir
npm run generate-doc-basename -- --kind task --name "my task"
npm run generate-doc-basename -- --kind workflow --task 1 --name "release train"
# step：须先有与 --task/--workflow 匹配的 t{T}w{W}-* 工作流目录；stdout 为 *.md 基名，stderr 为完整路径建议
npm run generate-doc-basename -- --kind step --task 1 --workflow 1 --name "first step"
npm run generate-doc-basename -- --kind milestone --name "gate one" --requirement-package r1-prototype-baseline
npm run generate-markdown -- --type requirement --name "next product slice"
npm run generate-markdown -- --type prerequisites --requirement-package r1-prototype-baseline --force
npm run generate-markdown -- --type workflow --task 1 --name "release train" --display-title "Release train"
npm test
# 或：node cli-tool/run-tests.mjs tests/cli-tool/generate-markdown.integration.test.mjs
```

模板占位符：`{{TITLE}}`、`{{BASE_NAME}}`、`{{NAME_SLUG}}`、`{{DATE_ISO}}`、`{{REQUIREMENT_PACKAGE}}`、`{{TASK_NUM}}`、`{{WORKFLOW_NUM}}`。

命名细则：`session_id` 见 [sessions.md](../docs/sessions/sessions.md)；其它基名见 [documentation-standards.md](../docs/documentation-standards.md) **文档 · 文档与路径命名规范**。
