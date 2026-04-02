# 仓库目录结构

本仓库按 [prototype/Adaptive-Flywheel.md](../prototype/Adaptive-Flywheel.md) 与 [product/step1-implementation-plan.md](./product/step1-implementation-plan.md) 组织。

| 路径 | 用途 |
| --- | --- |
| 根目录 `package.json`、`vite.config.ts`、`tsconfig*`、`index.html` | Vite + React + TypeScript |
| `src/` | 应用入口与源码（`main.tsx`、`App.tsx` 等） |
| `public/` | 静态资源 |
| `tests/` | 按模块划分的测试用例（占位见 `tests/example/`） |
| `cli-tool/` | 独立 CLI；见 [cli-tool/README.md](../cli-tool/README.md)；含 `lib/`（可编程复用）、`templates/`（Markdown 初稿模板） |
| `docs/` | Adaptive Flywheel 文档树与产品说明 |
| `prototype/` | 设计原稿（`.md`、`.drawio`）；Step 1 不改 drawio |
| `Dockerfile`、`nginx.conf`、`.dockerignore` | 多阶段构建与 SPA 静态服务 |

## 扩展性（预留后端与领域边界）

实现「两个循环、一个切面」架构时，建议在独立路径落地服务端与共享领域逻辑（名称可任选其一，入库后在本表固定）：

| 路径（预留） | 用途 |
| --- | --- |
| `server/` 或 `packages/api/` | HTTP/WebSocket 等对外 API，调用领域服务 |
| `packages/domain/`（可选） | 需求、门控、任务、工作流等**领域模型**与用例，不依赖具体 LLM 厂商 SDK |
| `packages/adapters/`（可选） | LLM、Git、构建器、消息队列等**适配器** |

**前端 `src/`**：宜用 `features/` 或按 **拼图 / 执行 / 迭代切面** 分子目录，**仅通过 API 与事件契约**访问后端；具体模块清单见 [product/backend-modules.md](./product/backend-modules.md)。

> 待完善：选定 `server/` 与 `packages/*` 命名后，更新本段与 `technology-stack.md` 中的启动方式。
