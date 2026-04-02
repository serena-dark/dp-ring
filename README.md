# dp-ring

TypeScript + React（Vite）前端基线，文档与流程约定见 [INDEX.md](./INDEX.md) 与 [prototype/Adaptive-Flywheel.md](./prototype/Adaptive-Flywheel.md)。

## 本地开发

```bash
npm ci
npm run dev
```

- 开发服务器默认：<http://localhost:5173>

## 脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | Vite 开发 |
| `npm run build` | 生产构建（输出 `dist/`） |
| `npm run preview` | 预览构建产物 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run generate-session-id -- --help` | 生成 **`session_id` 推荐字面值**（三段式；含义见 `docs/sessions/sessions.md`；形态见 `docs/documentation-standards.md`、`cli-tool/README.md`） |
| `npm run generate-doc-basename -- --help` | 其它文档/目录 `{前缀}-{name}`（无随机与日期，同上） |
| `npm run generate-markdown -- --help` | 自模板生成 requirement 等 Markdown（命名走 lib/doc-basename） |

## 容器（静态站点）

```bash
docker build -t dp-ring .
docker run --rm -p 8080:80 dp-ring
```

浏览器访问：<http://localhost:8080>

## 文档与价值

- [INDEX.md](./INDEX.md) — 文档总索引  
- [VALUE.md](./VALUE.md) — 核心价值与目标  

要求 Node **≥ 22.19.0**（见 `package.json` 的 `engines`）。
