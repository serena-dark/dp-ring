# 文档与注释编写规范

本文档规定本仓库内 **Markdown 文档**与**代码注释**在撰写前应遵循的约定；是编写、评审任何文档或注释前的**必读依据**。其它文档在需要统一口径时，可仅引用本文件而不再重复展开，例如：「文档结构见 [documentation-standards.md](./documentation-standards.md)」。

文档树目录约定仍以 [prototype/Adaptive-Flywheel.md](../prototype/Adaptive-Flywheel.md) 为准；**行文规则与首段要求**以本节为准。

---

## 适用范围

| 对象 | 说明 |
| --- | --- |
| 仓库内所有 `*.md` | 含根目录、`docs/**`、`prototype/**` 等 |
| 代码内注释 | 单行/块注释、`JSDoc`/`TSDoc` 等（语言以 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md) 为准时，注释仍须满足本节中与「说明对象」相关的条款） |

---

## 规则 1：开篇第一段须自描述

每个 Markdown 文档在标题（`#`）之后、第一个次级标题（`##`）之前，**必须**有一段连续正文作为**自描述段**（可为多句，但须紧邻标题、中间不插入列表或表格）。

自描述段**至少**交代：

1. **本文档是什么**（类型：规范、任务说明、需求包、会话记录等）。  
2. **解决什么问题 / 面向谁**（读者或消费场景）。  
3. **与其它文档的关系**（可选：上一级入口、依赖或替代阅读的链接）。

不要求固定句式，但评审时须能仅凭该段判断「是否应该读本文档、是否与当前工作相关」。

**多概念文档的版面**：若同一篇涉及多个并列概念或子模块（见下方 **1.2**），在**紧接自描述段之后、第一个 `##` 之前**，可增加**概念目录表**；该表**不属于**自描述段正文，自描述段本身仍须是连续正文，中间不插入列表或表格。

代码注释的对应要求：**注释块首句**应点明「所注释对象的作用或约束」，避免只写实现步骤而不说明目的（细则可与编码规范互链）。

### 1.1 自描述段不得承载后文细节

自描述段**仅用于定向**（见上文「至少交代」三条），**不得**预埋或复述**仅属于后文某一子模块**的细致约束、逐步流程、参数与取值说明、例外与 corner case 清单等。此类内容**只能**写在对应的 **`##` / `###` 子模块**（或其后小节）中；评审若见开篇大段细节与后文重复，应删并下移至子模块。

### 1.2 多概念/多子模块时的引言表与正文分割

当同一文档并列承载**多个概念或子模块**（例如不同环节、不同能力域、或「定义 / 步骤 / 附录」等并列块）时：

1. **引言**：除自描述段外，须在**自描述段之后、第一个 `##` 子模块标题之前**，用 **Markdown 表格**列出各概念或子模块（列至少含**名称**与**一句话角色/边界**；可增列：对应正文章节、对外链接等）。  
2. **正文**：每个同级子模块（通常对应一节 **`##` 标题**）与下一节之间，**必须**插入单独一行的分割线 `---`，使结构上与引言表逐项对应，避免大块粘连难扫。

全文**只有一个主题、无并列子模块**时，**不强制**引言表与块间分割线；仍须遵守 **1.1**，不得在自描述段展开细节。

---

## session_id（引用约定）

**`session_id` 是什么、在哪些环节使用（及与拼图解耦）**的唯一权威说明见 [docs/sessions/sessions.md](./sessions/sessions.md)；与本节冲突时以该文件为准。本节只规定：**何时在 Markdown 中标注**（规则 2）、**推荐字面值的三段式形态与 CLI/模块**（规则 3.1）、以及与 **`t…w…s…` 步骤 ID 的正则区别**（规则 3.1 段内表）。

---

## 规则 2：须标注 Session ID 的文档

凡内容**可溯源到某一轮协作执行**（非恒久规范），在标题之后、自描述段之中或紧随其后**第一句可见位置**，**宜**显式列出 **`session_id`**（含义见 [sessions.md](./sessions/sessions.md)），便于跨文档证明衔接与状态。

至少包含一行，使用统一标头，例如：

```markdown
**Session ID：** `<session_id>`
```

其中 `session_id` 须与同轮次其它引用、归档目录（若有）或元数据一致；**新建**时推荐采用 **规则 3.1** 三段式。

**典型适用（非穷举）**：

- `docs/tasks/**`、`**/workflows/**` 中绑定本轮执行的说明  
- `docs/requirements/**`、`**/feedbacks/**` 中与某轮强绑定的讨论稿或结案包  
- `docs/sessions/**`、`docs/sessions/archive/<session_id>/`  
- `docs/output/**`、`docs/procedure/**` 等与轮次绑定的产物说明  

**不适用**：与具体轮次无关的恒久规范（如本文件、纯工具索引），无需标注 Session ID。

若同一文档涉及多个 `session_id`，应**逐条列出**或说明主从关系。

---

## 规则 3：路径基名（session_id 三段式与其它）

与 [prototype/Adaptive-Flywheel.md](../prototype/Adaptive-Flywheel.md) 对齐时：**`session_id` 推荐字面值**为「名称 + 随机 + 日期」**三段式**（见 3.1），常用于文内引用并与标准归档目录同名；**其余**文档基名**不得**包含随机码，**不得**把日期塞进路径或文件名（日期写在**正文**中）。

### 3.1 session_id 推荐字面值与标准归档目录（三段式）

`buildSessionArchiveBasename` / CLI 产出的 **basename** 即推荐的 **`session_id` 字面值**；其中一种落点为 `docs/sessions/archive/<basename>/`（从外向内用 `-` 只拆成 **3 段**）：

```text
s{N}-{name}-{6位随机小写字母与数字}{YYYYMMDD}
```

| 段 | 含义 |
| --- | --- |
| **s{N}** | `s` + 本目录内下一个序号（仅匹配 `^s\d+-` 的条目）。 |
| **name** | CLI **`--name`**（`--title` 等价）人工概括，最多 **5 个词**，路径安全化规则同前。 |
| **第三段** | **6 位**随机（首尾为字母、至少 2 位数字）与 **8 位 YYYYMMDD** **直接拼接**，中间**无**连字符。 |

**为何不混用 `t1w1s1` 中的 `s`：** 会话 ID 形如 **`s` + 数字 + `-`…**；工作流步骤 ID 形如 **`t`…`w`…`s`…`-`…**（先有 `t`、`w` 才有 `s`）。二者正则模式不同，**不会**冲突。

**工具**：`npm run generate-session-id`（见 [cli-tool/README.md](../cli-tool/README.md)）。

### 3.2 其它文档（无随机、路径中无日期）

需求、任务、工作流、步骤、反馈包、output、procedure 等基名**仅**为：

```text
{prototype 约定前缀}-{name}
```

- **name**：同上，来自人工 `--name`，最多 5 词。  
- **禁止**在路径/文件名中加入 `YYYYMMDD`、`HHmmss`、随机串。需要记录时间时，写在 Markdown **正文**（如自描述段、元数据小节）。  

**工具**：`npm run generate-doc-basename`；`--kind` 与前缀、目录对照见该工具 `--help` 或下表。

| `--kind` | 基名前缀示例 | 扫描/落点 |
| --- | --- | --- |
| `feedback` | `f1-…` | `docs/feedbacks` |
| `requirement` | `r1-…` | `docs/requirements` |
| `output` | `o1-…` | `docs/output` |
| `preparation` | `p1-…` | `docs/procedure/preparation` |
| `distillation` | `d1-…` | `docs/procedure/distillation` |
| `evolution` | `e1-…` | `docs/procedure/evolution` |
| `task` | `t1-…` | `docs/tasks` |
| `workflow` | `t1w1-…`（须 `--task`） | `docs/tasks/workflows` |
| `step` | `t1w1s1-…`（须 `--task`、`--workflow`） | 建议 `.md` 见工具说明 |
| `milestone` | `r1m1-…`（须 `--requirement-package`，且包目录名为 `r1-…`） | `docs/requirements/<包>/milestones/` |

**仅打印基名**：`npm run generate-doc-basename`（实现为 `cli-tool/lib/doc-basename.mjs`）。

**自模板创建 Markdown**（requirement、milestone、prerequisites、task、workflow、feedback）：`npm run generate-markdown`，模板在 `cli-tool/templates/`；**不得**在其它脚本中重复实现与上表冲突的拼名逻辑，应 `import { computeDocBasename } from '…/cli-tool/lib/doc-basename.mjs'`。

**`session_id` / 三段式字面值（代码中）**：须 `import { buildSessionArchiveBasename } from '…/cli-tool/lib/session-id.mjs'`，见 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md)。

历史路径若曾含日期或随机后缀，不强制批量重命名；**新增**须遵守上表。

---

## 约定与扩展

- 新建文档除满足上述规则外，仍建议保留最小结构：`# 标题`、自描述段、`> 待完善：` 引导后续补写（与历史约定一致）。  
- 新增「文档写作规范」条目时，应追加为**编号规则**（规则 4、规则 5…）；已占用 **规则 1.1 / 1.2**（自描述信息边界与多概念排版）。并视需要补充正反例；避免在散落文档中重复定义。  
- 与 drawio、需求编号、中英文混排相关的细则：在后续规则中补全。

> 待完善：中英文风格、链接与锚点约定、与 drawio/外部系统的编号对照、注释与 `TSDoc` 字段级模板。
