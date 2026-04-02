# 工作流 · 文档与 CLI 脚手架（正式化）

| 键 | 值 |
| --- | --- |
| **简介** | 本仓库内「创建文档/目录」时 CLI 与 `import` 的**固定先后顺序**及工具索引。 |
| **读者** | 实现/评审脚手架的人机与 Agent。 |
| **约定** | `session_id` 全文见 [sessions.md](../../../sessions/sessions.md)；非 session 基名见 [documentation-standards.md](../../../documentation-standards.md) **文档 · 文档与路径命名规范**。 |

## 决策表（先选场景）

| 场景 | 第一步 | 第二步（若有） |
| --- | --- | --- |
| 需要**新的 `session_id` 字面值**（归档目录、文首引用、任务衔接等统一用同串） | `npm run generate-session-id -- --name "…"` 或 `buildSessionArchiveBasename(...)` | 把返回的 `basename` 写入正文/元数据；可选 `--mkdir` 建 `docs/sessions/archive/…` |
| 需要**模板化 Markdown**（requirement / milestone / prerequisites / task / workflow / feedback） | 上表已取得 `session_id` 后（若本轮需要写入文档） | `npm run generate-markdown -- --type … --name "…"`（内部已 `computeDocBasename`，勿先跑 doc-basename 只为取名） |
| **仅要路径基名**、不落模板 | `npm run generate-doc-basename` 或 `computeDocBasename(...)` | — |

## 命令字典

| npm | 作用 |
| --- | --- |
| `generate-session-id` | 生成 **session_id** 标准字符串（三段式），可选创建归档目录 |
| `generate-markdown` | 按 `cli-tool/templates/` 写文件；命名走 `doc-basename` |
| `generate-doc-basename` | 仅打印 `r*`/`t*wk*` 等非 session 基名 |

## 模块字典（JS 内禁止手拼 `s1-` / `r1m1-`）

| import | 自 |
| --- | --- |
| `buildSessionArchiveBasename` | `cli-tool/lib/session-id.mjs` |
| `computeDocBasename` | `cli-tool/lib/doc-basename.mjs` |
| `takeUpToFiveWords` 等 | `cli-tool/lib/naming-shared.mjs` |

## 工具路径索引

| 类型 | 路径 |
| --- | --- |
| CLI | `cli-tool/generate-session-id.mjs`、`generate-doc-basename.mjs`、`generate-markdown.mjs` |
| 库 | `cli-tool/lib/session-id.mjs`、`doc-basename.mjs`、`naming-shared.mjs` |
| 模板 | `cli-tool/templates/*.md` |

---

## 参考

- [cli-tool/README.md](../../../../cli-tool/README.md)
- [documentation-standards.md](../../../documentation-standards.md)
- [repository-layout.md](../../../repository-layout.md)
- [prototype/Adaptive-Flywheel.md](../../../../prototype/Adaptive-Flywheel.md)
