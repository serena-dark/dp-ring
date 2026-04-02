# 核心价值与目标

dp-ring 以 **Adaptive Flywheel（自适应飞轮）** 为产品骨架，整体分为三个**逻辑独立**的环节：

1. **拼图环节**：从原始需求出发，经分析拆解、里程碑与先决条件分析，蒸馏反馈并与用户澄清需求，可**异步**运转，**不与执行任务对齐**；由「有效反馈」等触发器唤醒下一轮。  
2. **执行环节**：在里程碑与门控就绪后，经准备、混合智能体任务分发、**1 任务 : 1 工作流**、编码与测试等步骤，再经检查—合并—构建—清理，向用户交付产物；任务必须**显式选择并行**（监督器 + 冲突时智能体建议与人决断）或**串行**（队列、节省资源）。  
3. **迭代环节（切面）**：横切上述两者——失败则推理审计并形成反馈，成功则沉淀工作流资产与排行榜；每次 Session **无论成败**都做知识蒸馏，供下一轮使用。  

上述语义在文档与（未来）运行时中均应保持**可追踪、可复现**；**进入执行轮次后**以 **`session_id`** 贯通该轮任务、状态与结案材料（**拼图环节不出现** `session_id`，见 [docs/core-logic.md](./docs/core-logic.md)）；权威定义见 [docs/sessions/sessions.md](./docs/sessions/sessions.md)。可独立演进的后端能力见 [docs/product/backend-modules.md](./docs/product/backend-modules.md)。

> 待完善：面向用户的价值主张、成功指标与非目标。

## 相关文档

- 文档总入口：[INDEX.md](./INDEX.md)
- 原型约定树：[prototype/Adaptive-Flywheel.md](./prototype/Adaptive-Flywheel.md)
- 两个循环、一个切面：[docs/core-logic.md](./docs/core-logic.md)
- `session_id` 与拼图边界：[docs/sessions/sessions.md](./docs/sessions/sessions.md)、[docs/core-logic.md](./docs/core-logic.md)
