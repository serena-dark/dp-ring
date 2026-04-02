# Sessions

本文件是本仓库 **`session_id` 语义、适用范围及「哪些环节如何使用」的唯一权威说明**；其它文档（含 [INDEX.md](../../INDEX.md)、[documentation-standards.md](../documentation-standards.md)）**只引用本文**，若口径冲突以**本文**为准。下文另用表格维护**会话轮次索引**（结案摘要）；**标准归档目录**为 `docs/sessions/archive/<session_id 字面值>/`（字面值形态与生成工具见 [documentation-standards.md](../documentation-standards.md) 规则 3.1）。

**与拼图环节的关系**（核心边界）：拼图阶段**不存在** `session_id`，与执行轮次**完全解耦**；理由见 [core-logic.md](../core-logic.md)。

---

## session_id（定义）

**`session_id`** 是在**门控已满足、已进入执行向交付推进**的这一轮协作中，为文档与（未来）运行时保留的**主关联标识**（推荐字值为三段式字符串，见 [documentation-standards.md](../documentation-standards.md) 规则 3.1）。它用于把**同一执行轮次**内的任务、工作流步骤、状态变化与可追溯产物**串成一条可证明的线索**——包括谁在何时从何种状态 transition 到何种状态、产物归属哪一轮。它不描述「需求是如何被理解出来的」，那部分属于拼图；拼图不要求、也不携带 `session_id`（见 [core-logic.md](../core-logic.md)）。

---

## 涉及 session_id 的环节（按执行先后）

下列顺序描述**从本轮执行被承认开始**到**结案归档**的主线；仅列**实际使用** `session_id` 的环节（**不含拼图**）。

| 顺序 | 环节 | 如何使用 session_id |
| --- | --- | --- |
| 1 | **执行轮次确立（门控通过后）** | 为本轮生成或选定**唯一** `session_id`，写入任务 / 工作流元数据（及文首字段），作为之后所有互文、日志键、路径片段的**同一主键**。 |
| 2 | **本轮前置准备（与执行绑定部分）** | 若将准备物料记入 `docs/procedure/preparation` 等，则在说明或路径约定中与该轮 **`session_id`** 关联，以便与任务起点对齐。 |
| 3 | **任务与工作流执行** | 步骤推进、并行/串行分支、状态机在文档与运行时中以同一 **`session_id`** 关联，证明衔接与状态变迁。 |
| 4 | **交付与输出** | `docs/output` 等产物在元数据或路径上与本轮 **`session_id`** 绑定，便于验收与复盘。 |
| 5 | **迭代切面（本轮绑定的过程记录）** | 失败推理、知识蒸馏、工作流正式化、进化记录等（`docs/procedure` 下与轮次相关的子树）**挂到该轮 `session_id`**，供下一轮拼图或执行消费（蒸馏与 Session 边界仍受产品规则约束）。 |
| 6 | **会话结案与归档** | 在本文件增写索引条目，并可于 `docs/sessions/archive/<session_id>/` 落地结案材料；索引、目录名与文内引用**同源**。 |

**工具**：生成推荐字面值使用 `npm run generate-session-id` 或 `cli-tool/lib/session-id.mjs` 的 `buildSessionArchiveBasename`（不得手拼随机与日期）。

---

## 轮次索引

### 2026-04-02 · session-step1-baseline

**Session ID：** `session-step1-baseline`

- **关联需求**：[r1-prototype-baseline](../requirements/r1-prototype-baseline/r1-prototype-baseline.md)
- **关联任务**：[t1-step1-baseline](../tasks/t1-step1-baseline/t1-step1-baseline.md)
- **关联工作流**：[t1w1-baseline-delivery](../tasks/workflows/t1w1-baseline-delivery/t1w1-baseline-delivery.md)
- **摘要**：按 prototype 与 Step 1 补齐文档树、根文档、范例需求—任务—工作流链；工程侧补齐 `.gitignore`、测试占位与 ESLint；验收 `build` / `typecheck` / `lint` 已通过。
- **状态**：结案（基线可用）。

> 历史条目：`session-step1-baseline` 非规则 3.1 三段式，不要求回迁；**新建**轮次须按 [documentation-standards.md](../documentation-standards.md) 规则 3.1 生成 `session_id`。
