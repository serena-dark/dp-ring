# 文档与注释编写规范

本文档规定当前 `dp-ring v2` 仓库内 Markdown 文档与代码注释的编写口径。它负责约束“现在如何写”，而不是继续让历史原型文档承担治理职责。需要统一说法时，其它文档应引用本文，不应在多处重复定义同一规则。

---

## 文档治理边界

### 当前权威文档

当前体系只认以下几类权威来源：

| 主题 | 权威文档 |
| --- | --- |
| 项目入口 | [README.md](../README.md)、[INDEX.md](../INDEX.md) |
| 平台价值与原则 | [VALUE.md](../VALUE.md) |
| 当前架构 | [docs/v2/ARCHITECTURE.md](./v2/ARCHITECTURE.md) |
| 仓库结构 | [docs/repository-layout.md](./repository-layout.md) |
| 文档规范 | 本文档 |
| 公共 HTTP 契约 | `contracts/openapi/openapi.yaml` |
| 内部 gRPC / 事件契约 | `contracts/proto/*.proto` |

历史文档可以保留，但**不得**继续定义当前平台结构、目录总纲或现行产品语义。

### 当前文档与历史文档的区分

- **当前文档**：描述 `dp-ring v2` 现在如何工作，优先放在根目录、`docs/v2/`、`contracts/` 及与实现相邻的位置。
- **历史文档**：描述旧 `ring / .ring / Adaptive Flywheel` 体系，可继续保留在原位置作为 archive reference，但默认不再是现行规则来源。
- 如需引用历史概念，必须显式写明 `legacy`、`historical` 或“历史参考”，避免读者误判为当前行为。

### 禁止事项

- 不得再以 `docs/archive/legacy-adaptive-flywheel/prototype/Adaptive-Flywheel.md` 作为当前文档树总纲。
- 不得在多个文档中各自维护同一主题的“唯一权威说明”。
- 不得把旧 `session_id`、旧 artifact 命名、旧 `.ring/` 目录规则写成当前 v2 的现行约束。

---

## 文档放置规则

### 根目录

根目录只放项目级入口和跨仓库治理文档：

- `README.md`
- `INDEX.md`
- `VALUE.md`

除非某份文档必须作为仓库顶层入口，否则不要继续在根目录扩张零散说明。

### `docs/v2/`

`docs/v2/` 只放当前平台设计文档，例如：

- 架构
- 领域模型
- RBAC
- 运行与运维
- 数据流与活动流

这类文档描述的是“当前系统应该如何理解和演进”。

### 与实现相邻的文档

下列信息优先贴近代码和契约：

- 对外 HTTP 接口：`contracts/openapi/`
- 内部协议：`contracts/proto/`
- 服务专项设计：必要时放在对应 `services/<name>/` 邻近位置
- App 专项说明：必要时放在对应 `apps/<name>/` 邻近位置

如果文档只服务某个模块，不要把它提升成全仓库总纲。

### 历史文档

旧 `ring` 体系的核心 Markdown 已迁入 `docs/archive/legacy-adaptive-flywheel/`。其余 legacy 目录仍保留在仓库中，也应按“历史参考”看待：

- `docs/archive/legacy-adaptive-flywheel/docs/core-logic.md`
- `docs/archive/legacy-adaptive-flywheel/docs/sessions/sessions.md`
- `docs/archive/legacy-adaptive-flywheel/docs/product/adaptive-flywheel.md`
- `docs/archive/legacy-adaptive-flywheel/prototype/**`
- `ring/**`
- `ring-gui/**`
- `.ring/**`
- `cli-tool/**`

新文档不应继续扩写这套历史结构，除非目标就是补历史说明。

正式 archive 编目入口见 [docs/archive/legacy-adaptive-flywheel/README.md](./archive/legacy-adaptive-flywheel/README.md)。

---

## 文档内容规则

### 自描述段

每个 Markdown 文档在标题 `#` 之后、首个 `##` 之前，必须有一段连续正文作为自描述段。

自描述段至少说明：

1. 这份文档是什么。
2. 面向谁、解决什么问题。
3. 它与其它权威文档的关系。

自描述段只负责定向，不负责提前塞入大量流程细节、参数表或例外列表。

### 多主题文档

当一篇文档并列承载多个主题时：

- 自描述段之后可放概览表。
- 并列的 `##` 章节之间使用单独一行 `---` 分隔。
- 每个主题只解释自己的边界，不重复其它章节已经定义的规则。

### 单一事实来源

每个主题只保留一个主要解释位置：

- 架构不要同时在 `README`、`VALUE`、`ARCHITECTURE` 三处展开到同一深度。
- 命名规则不要同时在索引、产品文档、实现说明里重复维护。
- 某条规则若已有权威文档，其它文档只做简述并链接过去。

### 当前语义优先

当前文档默认使用 v2 术语：

- `Organization`
- `Workspace`
- `Repository`
- `Objective`
- `Blueprint`
- `WorkItem`
- `Execution`
- `Review`
- `Finding`
- `Insight`
- `Worker`

若必须提及旧 `requirement / session / task / workflow`，必须明确标注它是历史术语。

### 历史 `session_id`

`session_id` 不是当前 v2 文档体系的核心命名规则。若某篇文档是在解释旧流程中的 `session_id`，应仅把 [docs/sessions/sessions.md](./archive/legacy-adaptive-flywheel/docs/sessions/sessions.md) 作为历史参考引用，不应把该规则扩展成当前平台通用规则。

---

## 注释规则

### 注释目标

代码注释和 `JSDoc` / `TSDoc` 应解释：

- 为什么存在这段逻辑
- 它保护了什么边界或约束
- 调用方需要知道什么前提

不要把显而易见的实现步骤逐行翻译成注释。

### 跨文档引用

注释中引用文档时：

- 优先引用当前权威文档。
- 若引用历史文档，注明 `legacy` 或 `historical`。
- 保持路径可解析，避免口头化引用。

---

## 维护信息

- **最后更新时间**：2026-04-15
- **当前治理原则**：当前平台文档与历史文档必须分层；历史文档保留但不再拥有现行治理权。
