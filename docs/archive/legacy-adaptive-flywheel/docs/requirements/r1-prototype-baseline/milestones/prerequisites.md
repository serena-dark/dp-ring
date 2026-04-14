# r1 · 先决条件（Satisfied / Unsatisfied）

对照 [step1-implementation-plan.md](../../../product/step1-implementation-plan.md) 「执行清单」。

## Satisfied（已满足）

| 项 | 说明 |
| --- | --- |
| vite-react-ts | Vite + React + TS、`src` 入口、`package-lock.json` 锁定 |
| docker-baseline | `Dockerfile`、`nginx.conf`、`.dockerignore` |
| root-docs | `README.md`、`INDEX.md`、`VALUE.md` |
| docs-tree | `docs/**` 按 prototype 展开（本里程碑交付） |
| tests-placeholder | `tests/example/` 占位 |
| verify-build | `npm run build`、`npm run typecheck`、`npm run lint` 可通过 |

## Unsatisfied（本阶段不做的项）

| 项 | 说明 |
| --- | --- |
| 路由 / 全局状态库 | Step 1 明确不引入 |
| 后端与 API | 见 [backend-modules.md](../../../product/backend-modules.md) 留白 |
| 修改 `prototype/*.drawio` | Step 1 不改，除非另开任务 |

> 待完善：门控与「拼图」环节未满足项的蒸馏格式。
