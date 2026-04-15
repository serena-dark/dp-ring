> Archived: 本文档定义的是旧原型期文档树，不再作为当前仓库目录总纲。当前治理文档见 [README.md](../../../../README.md)、[INDEX.md](../../../../INDEX.md)、[docs/repository-layout.md](../../../repository-layout.md) 与 [docs/documentation-standards.md](../../../documentation-standards.md)。

`README.md`: 项目的介绍和展示文档, 面向用户和其它开发者.

`INDEX.md`: 项目的入口文档, 介绍本项目所有文档的组织方式, 可以索引到所有的文档子入口.

`VALUE.md`: 项目的核心价值及目标.

-------------------------------------

## `/docs/`
1. `repository-layout.md`: 项目的目录结构
2. `technology-stack.md`: 项目的技术栈
3. `documentation-standards.md`: 项目文档及注释编写规范
4. `redline.md`: 绝对不能触碰的红线和禁忌条约. 


### `/docs/specs/coding/`
1. `./coding-standards.md`: 项目的代码规范 (编码格式, 命名规范, 模块管理 ...), 该子目录的入口文档.


### `/docs/specs/testing/`
1. `./testing-standards.md`: 项目的测试规范 (测试流程, 测试用例, 测试报告 ...), 该子目录的入口文档.


### `/docs/specs/review/`
1. `./review-standards.md`: 项目的代码及测试复核规范, 该子目录的入口文档.


### `/docs/specs/tasks/`
1. `./task-standards.md`: 任务的创建及描述规范.


### `/docs/specs/workflow/`
1. `./workflow-standards.md`: 工作流的创建及描述规范.

-------------------------------------

### `/docs/requirements/`
1. `./r1-requirement-name/`: 产品经理/用户提出的需求, 根据该需求的实际内容命名.
2. `./checklist.md`: 记录所有需求的进展和状态.
3. `./archive/rx-requirement-name-YYYY-MM-DD/`: 已完成需求的里程碑, 目录名称后缀为归档时间.


### `/docs/requirements/r1-requirement-name/`
1. `r1-requirement-name.md`: 产品经理/用户提出的需求, 根据该需求的实际内容命名.
2. `./references/`: 该需求的参考资料.

3. `./milestones/`: 该需求对应的所有里程碑.
4. `./milestones/prerequisites.md`: 用于实现该需求拆解出的所有里程碑的必要前提条件, 包括 Satisfied 和 Unsatisfied 两部分.
5. `./milestones/r1m1-milestone-name.md`: 该需求的里程碑 milestone-name, 根据该里程碑的实际内容命名.

-------------------------------------

### `/docs/tasks/`
1. `./t1-task-name/`: task-name 的所有文档, 根据该任务的实际作用命名.
2. `./t1-task-name/t1-task-name.md`: task-name 的同名文档, 定义该任务.


### `/docs/tasks/workflows/`
1. `./t1w1-workflow-name/`: workflow-name 的所有文档, 根据该工作流的实际作用命名.
2. `./t1w1-workflow-name/t1w1-workflow-name.md`: workflow-name 的同名文档, 定义该工作流.
3. `./t1w1-workflow-name/t1w1s1-step-name.md`: workflow-name 的 step-name 步骤, 根据该步骤的实际行为命名.
4. `./t1w1-workflow-name/logs/YYYY-MM-DD.log`: 该工作流执行的日期的日志文件.

-------------------------------------

### `/docs/sessions/`
1. `./sessions.md`: All sessions.
2. `./archive/session-id/...`: Archived sessions.


### `/docs/assets/`
1. `./failure-reasoning/failure-and-solution-name-session-id/`: 已排查清楚的问题和解决方案。
2. `./formalized_workflow/workflow-name-session-id/`: 已正式化的工作流。


### `/docs/output/`
1. `./o1-output-name-session-id/...`: 轮次 session-id 的 输出 output-name.

-------------------------------------

### `/docs/procedure/preparation/`
1. `./p1-preparation-name-session-id/...`: 轮次 session-id 的所有任务开始之前必须的前置准备工作，物料存放处.


### `/docs/procedure/reasoning/`
1. `./session-id-failure-reasoning-record.md`: 针对轮次 session-id 中出现的所有错误的排查过程和处理记录。


### `/docs/procedure/formalization/`
1. `./session-id-workflow-formalization-record.md`: 将轮次 session-id 中出现的高价值、可复用的工作流提取出来作为资产。


### `/docs/procedure/distillation/`
1. `./d1-distillation-name-session-id/d1-distillation-name-session-id.md`: 轮次 session-id 的 distillation-name 知识蒸馏的成果，根据知识蒸馏产出的实际成果命名.
2. `./d1-distillation-name-session-id/...`: distillation-name 的文档引用资料.


### `/docs/procedure/evolution/`
1. `./e1-evolution-name-session-id/e1-evolution-name-session-id.md`: session-id 轮次的 evolution-name 迭代进化的成果, 根据本次迭代进化产出的实际成果命名.
2. `./e1-evolution-name-session-id/...`: evolution-name 的文档引用的资料.

-------------------------------------

### `/docs/feedbacks/`
1. `Feedback.md`: Feedback 的入口文档
2. `./archive/fx-feedback-name-YYYY-MM-DD/`: 已不再有价值的反馈, 目录名称后缀为归档时间.

3. `./f1-feedback-name/`: feedback-name 的所有文档, 根据该反馈的实际内容命名.
4. `./f1-feedback-name/feedback-name.md`: feedback-name 的同名文档, 详细记录反馈内容.
5. `./f1-feedback-name/...`: feedback-name 的文档引用的资料, 例如: 文档, 图片, 参考代码, 输入输出，测试用例及报告.

-------------------------------------

## `/tests/`
1. `./module-name/...`: module-name 模块下的测试用例. 
