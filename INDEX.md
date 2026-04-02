# 项目文档索引

本仓库文档按 [prototype/Adaptive-Flywheel.md](./prototype/Adaptive-Flywheel.md) 组织；工程实施阶段与 [docs/product/step1-implementation-plan.md](./docs/product/step1-implementation-plan.md) 对齐。

## 术语（入口共识）

| 术语 | 含义 |
| --- | --- |
| **`session_id`** | **定义、涉及环节、与拼图解耦**以 [docs/sessions/sessions.md](./docs/sessions/sessions.md) 为**唯一权威**；拼图与执行轮次边界见 [docs/core-logic.md](./docs/core-logic.md)。**不是**「仅归档用」。推荐字面值形态与工具见 [documentation-standards.md](./docs/documentation-standards.md) 规则 3.1。 |
| **标准归档目录** | `docs/sessions/archive/<session_id 字面值>/` 为其中一种落点；详见 sessions.md。 |
| **何处不写 Session ID 栏** | 恒久规范、纯工具索引等，见 [documentation-standards.md](./docs/documentation-standards.md) 规则 2。 |

## 根文档

| 文档 | 说明 |
| --- | --- |
| [README.md](./README.md) | 介绍、安装、运行、容器 |
| [VALUE.md](./VALUE.md) | 核心价值与目标 |

## `docs/` 一级

| 文档 | 说明 |
| --- | --- |
| [docs/repository-layout.md](./docs/repository-layout.md) | 目录结构 |
| [docs/technology-stack.md](./docs/technology-stack.md) | 技术栈与版本 |
| [docs/documentation-standards.md](./docs/documentation-standards.md) | 文档与注释规范 |
| [docs/core-logic.md](./docs/core-logic.md) | 两个循环、一个切面：定义、步骤顺序、文字箭头；拼图与 `session_id` 边界 |
| [docs/redline.md](./docs/redline.md) | 红线与禁忌 |

## 规格 `docs/specs/`

| 路径 | 说明 |
| --- | --- |
| [docs/specs/coding/coding-standards.md](./docs/specs/coding/coding-standards.md) | 代码规范 |
| [docs/specs/testing/testing-standards.md](./docs/specs/testing/testing-standards.md) | 测试规范 |
| [docs/specs/review/review-standards.md](./docs/specs/review/review-standards.md) | 复核规范 |
| [docs/specs/tasks/task-standards.md](./docs/specs/tasks/task-standards.md) | 任务规范 |
| [docs/specs/workflow/workflow-standards.md](./docs/specs/workflow/workflow-standards.md) | 工作流规范 |

## 需求、任务与过程

| 区域 | 入口 |
| --- | --- |
| 需求 | [docs/requirements/checklist.md](./docs/requirements/checklist.md) |
| 任务 | [docs/tasks/t1-step1-baseline/t1-step1-baseline.md](./docs/tasks/t1-step1-baseline/t1-step1-baseline.md)（范例） |
| 工作流（范例） | [docs/tasks/workflows/t1w1-baseline-delivery/t1w1-baseline-delivery.md](./docs/tasks/workflows/t1w1-baseline-delivery/t1w1-baseline-delivery.md) |
| 会话 | [docs/sessions/sessions.md](./docs/sessions/sessions.md) |
| 反馈 | [docs/feedbacks/Feedback.md](./docs/feedbacks/Feedback.md) |
| 程序 / 资产 / 输出 | `docs/procedure/`、`docs/assets/`（如 [正式化工作流 · 文档 CLI 链](./docs/assets/formalized_workflow/doc-cli-scaffold-chain-20260402/doc-cli-scaffold-chain-20260402.md)）、`docs/output/` |

## 产品与技术产品说明 `docs/product/`

| 文档 | 说明 |
| --- | --- |
| [docs/product/step1-implementation-plan.md](./docs/product/step1-implementation-plan.md) | Step 1 实施计划与清单 |
| [docs/product/adaptive-flywheel.md](./docs/product/adaptive-flywheel.md) | 原型与能力映射（占位） |
| [docs/product/backend-modules.md](./docs/product/backend-modules.md) | 后端模块留白 |

## 设计原型（原稿，Step 1 不改 drawio）

- [prototype/Adaptive-Flywheel.md](./prototype/Adaptive-Flywheel.md)
- [prototype/Adaptive-Flywheel.drawio](./prototype/Adaptive-Flywheel.drawio)
