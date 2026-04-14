# Sessions

> Archived: 本文档只解释旧流程中的 `session_id`。它不是 `dp-ring v2` 的当前治理文档；当前平台文档以 [README.md](../../../../../README.md)、[VALUE.md](../../../../../VALUE.md)、[docs/v2/ARCHITECTURE.md](../../../../v2/ARCHITECTURE.md) 与 [docs/documentation-standards.md](../../../../documentation-standards.md) 为准。

本文件记录旧仓库流程里 **`session_id` 语义**、**执行中哪些环节使用**、**在 Markdown 中如何标注**、以及**推荐字面值与归档路径及工具**。它只服务历史 Adaptive Flywheel / `ring` 体系内部的解释，不再作为当前平台的通用规则来源。与旧拼图边界见 [core-logic.md](../core-logic.md)。**非 `session_id` 的旧文档/路径基名规则**可参考 [documentation-standards.md](../../../../documentation-standards.md) 中保留下来的历史说明。

| 章节 | 内容 |
| --- | --- |
| session_id（定义） | 主键语义与拼图边界 |
| 涉及环节（按执行先后） | 用法表 |
| 在文档中标出 | 何时宜标注、格式、适用路径 |
| 推荐字面值三段式与归档 | 形态、`t1w1s1` 区别、CLI、代码导入 |
| 轮次索引 | 结案条目与历史说明 |

---

## session_id（定义）

**`session_id`** 是在**门控已满足、已进入执行向交付推进**的这一轮协作中，为文档与（未来）运行时保留的**主关联标识**。推荐字值为下文「推荐字面值三段式与归档」一节中的形态。它用于把**同一执行轮次**内的任务、工作流步骤、状态变化与可追溯产物**串成一条可证明的线索**——包括谁在何时从何种状态 transition 到何种状态、产物归属哪一轮。它不描述「需求是如何被理解出来的」，那部分属于拼图；拼图不要求、也不携带 `session_id`（见 [core-logic.md](../core-logic.md)）。

---

## 涉及环节（按执行先后）

下列顺序描述**从本轮执行被承认开始**到**结案归档**的主线；仅列**实际使用** `session_id` 的环节（**不含拼图**）。

| 顺序 | 环节 | 如何使用 session_id |
| --- | --- | --- |
| 1 | **执行轮次确立（门控通过后）** | 为本轮生成或选定**唯一** `session_id`，写入任务 / 工作流元数据（及文首字段），作为之后所有互文、日志键、路径片段的**同一主键**。 |
| 2 | **本轮前置准备（与执行绑定部分）** | 若将准备物料记入 `docs/procedure/preparation` 等，则在说明或路径约定中与该轮 **`session_id`** 关联，以便与任务起点对齐。 |
| 3 | **任务与工作流执行** | 步骤推进、并行/串行分支、状态机在文档与运行时中以同一 **`session_id`** 关联，证明衔接与状态变迁。 |
| 4 | **交付与输出** | `docs/output` 等产物在元数据或路径上与本轮 **`session_id`** 绑定，便于验收与复盘。 |
| 5 | **迭代切面（本轮绑定的过程记录）** | 失败推理、知识蒸馏、工作流正式化、进化记录等（`docs/procedure` 下与轮次相关的子树）**挂到该轮 `session_id`**，供下一轮拼图或执行消费（蒸馏与 Session 边界仍受产品规则约束）。 |
| 6 | **会话结案与归档** | 在本文件增写索引条目，并可于 `docs/sessions/archive/<session_id>/` 落地结案材料；索引、目录名与文内引用**同源**。 |

---

## 在文档中标出 session_id

凡内容**可溯源到某一轮协作执行**（非恒久规范），在标题之后、自描述段之中或紧随其后**第一句可见位置**，**宜**显式列出 **`session_id`**，便于跨文档证明衔接与状态。

至少包含一行，使用统一标头，例如：

```markdown
**Session ID：** `<session_id>`
```

其中 `session_id` 须与同轮次其它引用、归档目录（若有）或元数据一致；**新建**时推荐采用本文「推荐字面值三段式与归档」一节的三段式。

**典型适用（非穷举）**：

- `docs/tasks/**`、`**/workflows/**` 中绑定本轮执行的说明  
- `docs/requirements/**`、`**/feedbacks/**` 中与某轮强绑定的讨论稿或结案包  
- `docs/sessions/**`、`docs/sessions/archive/<session_id>/`  
- `docs/output/**`、`docs/procedure/**` 等与轮次绑定的产物说明  

**不适用**：与具体轮次无关的恒久规范文档（如 [documentation-standards.md](../../../../documentation-standards.md)）、纯工具索引，无需标注 Session ID。

若同一文档涉及多个 `session_id`，应**逐条列出**或说明主从关系。

---

## 推荐字面值三段式与归档

`buildSessionArchiveBasename`（`cli-tool/lib/session-id.mjs`）与 CLI `npm run generate-session-id` 产出的 **basename** 即推荐的 **`session_id` 字面值**；其中一种落点为 `docs/sessions/archive/<basename>/`（从外向内用 `-` 只拆成 **3 段**）：

```text
s{N}-{name}-{6位随机小写字母与数字}{YYYYMMDD}
```

| 段 | 含义 |
| --- | --- |
| **s{N}** | `s` + 本目录内下一个序号（仅匹配 `^s\d+-` 的条目）。 |
| **name** | CLI **`--name`**（`--title` 等价）人工概括，最多 **5 个词**；路径安全化与「其它文档」基名的 `name` 规则一致，见 [documentation-standards.md](../../../../documentation-standards.md)。 |
| **第三段** | **6 位**随机（首尾为字母、至少 2 位数字）与 **8 位 YYYYMMDD** **直接拼接**，中间**无**连字符。 |

**为何不混用 `t1w1s1` 中的 `s`：** 会话 ID 形如 **`s` + 数字 + `-`…**；工作流步骤 ID 形如 **`t`…`w`…`s`…`-`…**（先有 `t`、`w` 才有 `s`）。二者正则模式不同，**不会**冲突。

**工具**：`npm run generate-session-id`（见 [cli-tool/README.md](../../../../../cli-tool/README.md)）。

**代码中**：须 `import { buildSessionArchiveBasename } from '…/cli-tool/lib/session-id.mjs'`，见 [specs/coding/coding-standards.md](../specs/coding/coding-standards.md)。

---

## 轮次索引

### 2026-04-02 · session-step1-baseline

**Session ID：** `session-step1-baseline`

- **关联需求**：[r1-prototype-baseline](../requirements/r1-prototype-baseline/r1-prototype-baseline.md)
- **关联任务**：[t1-step1-baseline](../tasks/t1-step1-baseline/t1-step1-baseline.md)
- **关联工作流**：[t1w1-baseline-delivery](../tasks/workflows/t1w1-baseline-delivery/t1w1-baseline-delivery.md)
- **摘要**：按 prototype 与 Step 1 补齐文档树、根文档、范例需求—任务—工作流链；工程侧补齐 `.gitignore`、测试占位与 ESLint；验收 `build` / `typecheck` / `lint` 已通过。
- **状态**：结案（基线可用）。

> 历史条目：`session-step1-baseline` 非三段式，不要求回迁；**新建**轮次须按本文「推荐字面值三段式与归档」一节生成 `session_id`。
