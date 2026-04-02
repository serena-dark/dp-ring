# 技术栈

前端：**TypeScript + React（Vite）**；包管理与锁文件：**npm** + `package-lock.json`。根目录 [`.npmrc`](../.npmrc) 启用 `legacy-peer-deps=true`，以在锁定 ESLint 10 的同时安装 `eslint-plugin-react-hooks@7.0.1`（其 peer 范围尚未声明 ESLint 10）。具体依赖版本以根目录 `package.json` 与 lockfile 为准；Step 1 基准见 [product/step1-implementation-plan.md](./product/step1-implementation-plan.md) 中「依赖与镜像版本锁定」。

| 用途 | 选型 |
| --- | --- |
| 运行时 | React 19.x |
| 构建 | Vite 8.x |
| 类型 | TypeScript 5.8.x（strict） |
| 容器构建 | `node:22.22.2-alpine` |
| 容器运行 | `nginx:1.28.2-alpine`（SPA `try_files`） |

> 待完善：CI、预览环境与安全升级策略。
