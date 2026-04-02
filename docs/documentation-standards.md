# 文档与注释编写规范

本文档规定本仓库内 **Markdown 文档**与**代码注释**在撰写前应遵循的约定；是编写、评审任何文档或注释前的**必读依据**。需要统一口径时，其它文档可仅引用本文件而不再重复展开。

---

## 文档

### 文档创建及引用规范

**适用对象**

| 对象 | 说明 |
| --- | --- |
| 仓库内所有 `*.md` | 含根目录、`docs/**`、`prototype/**` 等 |

**与仓库目录总纲的关系**：文档树、目录落点仍以 [prototype/Adaptive-Flywheel.md](../prototype/Adaptive-Flywheel.md) 为准；**结构、命名、注释口径**以本文为准。

**创建**

- 通过 `npm run generate-markdown` 自模板创建 requirement、milestone、prerequisites、task、workflow、feedback 等 Markdown 初稿；模板在 `cli-tool/templates/`。**命令参数、`npm run … --` 写法与复制示例**见 [cli-tool/README.md](../cli-tool/README.md)；规范层面的基名与落点见下文「文档与路径命名规范」中的表。  
- **`session_id` 字面值**的生成与代码中的同源串：**仅**按 [sessions/sessions.md](./sessions/sessions.md) 与 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md)（不得手拼随机或日期片段）。  

**引用**

- 统一说明「文档结构」时，可写：见 [documentation-standards.md](./documentation-standards.md) **文档 · 文档结构规范**。  
- **`session_id`** 的语义、环节、文中标注、三段式与归档：**只引用** [sessions/sessions.md](./sessions/sessions.md)。  
- **代码与模块**层面的格式、API 约定：**见** [specs/coding/coding-standards.md](./specs/coding/coding-standards.md)。  

**新建文档的习惯做法**：除满足本文 **文档** 下各节外，仍建议增加 `> 待完善：` 引导后续补写（与历史约定一致）。

**后续增补**：中英文风格、链接与锚点、drawio/外部编号对照等，宜在本文 **文档** 或 **注释** 下**增列同级小节**，并更新文末**文档引用表**；避免在散落文档中重复定义同一规则。

> 待完善：中英文风格、链接与锚点约定、与 drawio/外部系统的编号对照、注释与 `TSDoc` 字段级模板。

---

### 文档与路径命名规范

与 [prototype/Adaptive-Flywheel.md](../prototype/Adaptive-Flywheel.md) 对齐时，用于 **Markdown 附件路径、目录名与相关基名**的约定分两类：**`session_id` 推荐字面值**（唯一允许「名称 + 随机 + 日期」三段式的会话主键），以及**其它文档基名**（无随机、路径中无日期）。日期与创建时间一律写在**正文**，不塞进路径或文件名。

#### `session_id`

语义、环节、文中标注、三段式字面值、归档路径、CLI 与 **`buildSessionArchiveBasename`** 等：**仅**在 [sessions/sessions.md](./sessions/sessions.md) 维护；代码模块约束见 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md)。

#### 其它文档（非 `session_id`）

需求、任务、工作流、步骤、反馈包、output、procedure 等基名形式为：

```text
{prototype 约定前缀}-{name}
```

- **name**：来自人工 `--name`，最多 **5 词**，路径安全化规则与 CLI / `doc-basename` 一致。  
- **禁止**在路径/文件名中加入 `YYYYMMDD`、`HHmmss`、随机串。需要记录时间时，写在 Markdown **正文**（如自描述段、元数据小节）。  

**工具（与谁对照读）**  

- **怎么用 CLI**（各子命令示例、占位符说明）：[cli-tool/README.md](../cli-tool/README.md)。  
- **规范层面对照**：下表（`--kind`、必需参数、扫描/落点）；当场帮助：`npm run generate-doc-basename -- --help`。

| `--kind` | 基名前缀示例 | 必需参数 / 约束 | 扫描 / 落点 |
| --- | --- | --- | --- |
| `feedback` | `f1-…` | — | `docs/feedbacks` |
| `requirement` | `r1-…` | — | `docs/requirements` |
| `output` | `o1-…` | — | `docs/output` |
| `preparation` | `p1-…` | — | `docs/procedure/preparation` |
| `distillation` | `d1-…` | — | `docs/procedure/distillation` |
| `evolution` | `e1-…` | — | `docs/procedure/evolution` |
| `task` | `t1-…` | — | `docs/tasks` |
| `workflow` | `t1w1-…` | `--task <T>` | `docs/tasks/workflows`：实体为**子目录** `t{T}w{W}-…`；`W` 在本根目录下对 `t{T}w*-` **目录名**递增扫描 |
| `step` | `t1w1s1-…` | `--task <T>`、`--workflow <W>` | `docs/tasks/workflows/<t{T}w{W}-* 工作流目录>/t{T}w{W}s{S}-<name>.md`：`S` 只在**该工作流目录内**按已有 `t{T}w{W}s*-*.md` 递增；与 `workflow` 同属 `docs/tasks/workflows` 扫描树，区别是步骤文件落在已存在的工作流子目录中，而非根目录 |
| `milestone` | `r1m1-…` | `--requirement-package <包目录名>`，包目录名须 `r{N}-…` | `docs/requirements/<包>/milestones/` |

**仅打印基名**：`npm run generate-doc-basename`（实现为 `cli-tool/lib/doc-basename.mjs`）；用法同上，**优先**对照 [cli-tool/README.md](../cli-tool/README.md)。

**自模板创建 Markdown**（requirement、milestone、prerequisites、task、workflow、feedback）：`npm run generate-markdown`，模板在 `cli-tool/templates/`；示例与选项说明见 [cli-tool/README.md](../cli-tool/README.md)。**不得**在其它脚本中重复实现与上表冲突的拼名逻辑，应 `import { computeDocBasename } from '…/cli-tool/lib/doc-basename.mjs'`。

历史路径若曾含日期或随机后缀，不强制批量重命名；**新建「其它文档」路径**须遵守上表；**新建 `session_id`** 遵守 [sessions/sessions.md](./sessions/sessions.md)（与 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md) 中的代码约束）。

---

### 文档结构规范

本节约定 Markdown **标题层级、自描述与分节排版**；细项只在下列子节展开一处。

#### 自描述段

每个 Markdown 文档在标题（`#`）之后、第一个次级标题（`##`）之前，**必须**有一段连续正文作为**自描述段**（可为多句，但须紧邻标题、中间不插入列表或表格）。

自描述段**至少**交代：

1. **本文档是什么**（类型：规范、任务说明、需求包、会话记录等）。  
2. **解决什么问题 / 面向谁**（读者或消费场景）。  
3. **与其它文档的关系**（可选：上一级入口、依赖或替代阅读的链接）。

不要求固定句式，但评审时须能仅凭该段判断「是否应该读本文档、是否与当前工作相关」。

若同一篇**多个并列概念或子模块**须加**概念目录表**：表的位置（相对自描述段与首个 `##`）、以及并列 `##` 之间的 `---`，**只**按下文「多概念与引言表、正文分割」执行；**概念目录表不属于自描述段**，自描述段内仍不得插入列表或表格。

#### 自描述段的信息边界

自描述段**仅用于定向**（见上文「至少交代」三条），**不得**预埋或复述**仅属于后文某一子模块**的细致约束、逐步流程、参数与取值说明、例外与 corner case 清单等。此类内容**只能**写在对应的 **`##` / `###` 子模块**（或其后小节）中；评审若见开篇大段细节与后文重复，应删并下移至子模块。

#### 多概念与引言表、正文分割

**何时需要**：同一文档并列承载**多个概念或子模块**（例如不同环节、不同能力域，或「定义 / 步骤 / 附录」等并列块）。

1. **引言**：在**自描述段之后、第一个 `##` 之前**，用 **Markdown 表格**列出各概念或子模块（列至少含**名称**与**一句话角色/边界**；可增列：对应正文章节、对外链接等）。  
2. **正文**：每个同级子模块（通常对应一节 **`##` 标题**）与下一节之间，**必须**单独一行 **`---`**，与引言表逐项对应，避免大块粘连。

全文**只有一个主题、无并列子模块**时，**不强制**引言表与块间分割线；仍须遵守「**自描述段的信息边界**」，不得在自描述段展开细节。

---

## 注释

### 注释格式规范

**适用对象**：代码内单行/块注释、`JSDoc`/`TSDoc` 等；**语言与工程级字段约定**以 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md) 为准，注释仍须满足本节**与「说明对象」相关的**条款。

**与 Markdown 的对应关系**：注释不适用 `#` / `##` 结构；但 **注释块首句**应相当于「所注释对象的自描述」——点明**作用或约束**，避免只写实现步骤而不说明目的。

**跨文件引用**：若在注释中指向仓库文档，使用相对路径或可解析的仓库内路径，并保持与 [specs/coding/coding-standards.md](./specs/coding/coding-standards.md) 一致。

---

## 维护信息

- **最后更新时间**：2026-04-02  
- **文档引用表**（本文件出现的**外部文档/路径**及文内**核心概念**，便于检索与同步修订）：

| 名称 | 路径或说明 |
| --- | --- |
| Adaptive Flywheel（文档树目录） | [prototype/Adaptive-Flywheel.md](../prototype/Adaptive-Flywheel.md) |
| Sessions（`session_id` 权威） | [docs/sessions/sessions.md](./sessions/sessions.md) |
| 编码规范（含 `session_id` 代码引用） | [docs/specs/coding/coding-standards.md](./specs/coding/coding-standards.md) |
| CLI 工具说明 | [cli-tool/README.md](../cli-tool/README.md) |
| `doc-basename.mjs` | `cli-tool/lib/doc-basename.mjs` |
| `session-id.mjs` | `cli-tool/lib/session-id.mjs` |
| Markdown 模板目录 | `cli-tool/templates/` |
| **自描述段** | `#` 后、`##` 前连续正文；不得插入列表/表格 |
| **概念目录表** | 多主题时，置于自描述段之后、首个 `##` 之前 |
| **正文分割** | 并列 `##` 之间单独一行 `---` |
| **`session_id` / `buildSessionArchiveBasename`** | 见 [sessions/sessions.md](./sessions/sessions.md) |
| **`computeDocBasename`** | 非 session 文档基名；见上文命名规范 |
| **`npm run generate-markdown`** | 自模板创建 Markdown |
| **`npm run generate-doc-basename`** | 打印规范化基名 |
| **`npm run generate-session-id`** | 生成 `session_id` 推荐字面值（详见 sessions） |
