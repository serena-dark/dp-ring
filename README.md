# dp-ring

Adaptive Flywheel for agent development workflows. Each session's output is measured, ranked, and distilled so the next session performs better.

## Architecture

```
.ring/          Machine-readable state (JSON, schemas, config, leaderboard)
ring/           Protocol library + CLI + REST API server (Node.js)
ring-gui/       Dashboard frontend (React + TypeScript + Vite)
docs/           Human-readable documentation
cli-tool/       Legacy CLI for doc/session naming conventions
```

## Quick Start

```bash
npm ci

# Start the backend API server
npm run ring:serve        # http://localhost:3100

# Start the frontend dev server (proxies /api to backend)
npm run dev               # http://localhost:5173
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite frontend dev server |
| `npm run build` | Production build (outputs `dist/`) |
| `npm run ring:serve` | Ring REST API server (port 3100) |
| `npm run ring -- <cmd>` | Ring CLI (create, read, list, update, validate, gate, rank, new-id, knowledge, context) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Run all tests (`tests/**/*.test.mjs`) |

## Container (static site)

```bash
docker build -t dp-ring .
docker run --rm -p 8080:80 dp-ring
```

## Documentation

- [INDEX.md](./INDEX.md) — Document index
- [VALUE.md](./VALUE.md) — Core value and goals
- [ring/API.md](./ring/API.md) — REST API documentation
- [ring-gui/TODOS.md](./ring-gui/TODOS.md) — Frontend implementation plan

Requires Node **>=22.19.0** (see `package.json` engines).
