# Technology Stack

> Archived: 本文档记录旧 `ring-gui` / `ring` 体系的技术栈，不代表当前 `dp-ring v2` 的技术选型。

## Frontend (`ring-gui/`)

| Purpose | Selection |
|---|---|
| Framework | React 19.x |
| Build | Vite 8.x |
| Language | TypeScript 5.8.x (strict) |
| Styling | TBD (CSS modules, Tailwind, or shadcn/ui — frontend agent's choice) |
| Routing | TBD (react-router-dom recommended) |
| State management | React state + context (add Zustand if needed) |

## Backend (`ring/`)

| Purpose | Selection |
|---|---|
| Runtime | Node.js >=22.19.0 |
| Language | JavaScript (ESM `.mjs`) |
| Schema validation | Ajv 8.17.1 + ajv-formats 3.0.1 |
| HTTP server | Node `node:http` (stdlib, no framework) |
| Data storage | JSON files in `.ring/` (git-tracked) |

## Container

| Purpose | Image |
|---|---|
| Build stage | `node:22.22.2-alpine` |
| Runtime | `nginx:1.28.2-alpine` (SPA `try_files`) |

## Package Management

- **npm** with `package-lock.json`
- Exact versions (no `^` / `~` for production dependencies)
- `.npmrc`: `legacy-peer-deps=true`

## Development Tools

| Tool | Version |
|---|---|
| ESLint | 10.1.0 |
| typescript-eslint | 8.58.0 |
| eslint-plugin-react-hooks | 7.0.1 |
| eslint-plugin-react-refresh | 0.5.2 |

## Testing

- `node:test` (Node.js built-in test runner)
- Test files: `tests/**/*.test.mjs`
- Run: `npm test`
