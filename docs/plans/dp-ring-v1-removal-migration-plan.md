# dp-ring v1 Removal Migration Plan

> **For Hermes:** Use subagent-driven-development discipline. Remove active legacy dependencies in small verified slices; do not delete `ring/`, `.ring/`, `ring-gui/`, or `cli-tool/` until each dependency edge is replaced and regression is green.

**Goal:** Fully remove active v1/legacy runtime, frontend, tooling, and test dependencies so the repository can delete `ring/`, `.ring/`, `ring-gui/`, and `cli-tool/` safely.

**Architecture:** The repo is currently in a mixed state: v2 is the declared authority, but active runtime and regression still depend on legacy assets. The migration must first sever dependency edges in this order: tooling/test runners → root frontend/ring-gui → managed stack/backend entrypoint → `.ring` state/schema/config → delete legacy directories.

**Tech Stack:** Node.js scripts, Vite, TypeScript, React operator-web, Rust v2 services (`control-api`, `runtime-broker`, `worker-daemon`).

---

## Dependency inventory summary

### Active blockers
1. `scripts/stack.mjs` still launches `ring/server.mjs` and persists under `.ring/runtime`.
2. `package.json` still exposes legacy commands (`ring`, `ring:serve`, `generate-*`).
3. Tests under `tests/ring/*` and remaining legacy frontend fixtures still import or execute legacy modules.
4. v2 `services/runtime-broker` and `agents/worker-daemon` are not mature enough yet to replace the legacy runtime flow.

### Completed first cleanup slice
- `npm run test:backend` now uses `scripts/run-backend-tests.mjs`
- `npm run test:frontend` now uses `scripts/run-frontend-tests.mjs`
- regression no longer depends on `cli-tool/run-tests.mjs` or `cli-tool/run-frontend-tests.mjs`

### Migration order
1. Remove active `cli-tool/` dependency from regression/package scripts. ✅ first slice done
2. Switch root frontend/tooling from `ring-gui/` to `apps/operator-web`.
   - Slice 2A: root `dev` / `build` / `preview` / `typecheck` scripts now proxy to `apps/operator-web`. ✅ done
   - Slice 2B: frontend test runner now executes both legacy `tests/ring-gui/**/*.test.ts` and new v2 `tests/operator-web/**/*.test.ts`. ✅ done
   - Slice 2C: root `vite.config.ts`, `tsconfig.json`, and `index.html` now align to `apps/operator-web` instead of `ring-gui/`. ✅ done
   - Slice 2D: legacy `tests/ring-gui/*` coverage has been replaced by `tests/operator-web/*`, and the frontend runner now resolves only operator-web tests. ✅ done
3. Move managed stack backend from `ring/server.mjs` to a v2 service-backed path.
4. Migrate tests off `tests/ring/*` and `.ring` fixtures.
5. Delete legacy directories only after all above are verified.

---

## Task 1: Remove regression/package-script dependence on `cli-tool/`

**Status:** completed

**Files:**
- Created: `scripts/run-backend-tests.mjs`
- Created: `scripts/run-frontend-tests.mjs`
- Created: `tests/scripts/test-runners.test.mjs`
- Modified: `package.json`
- Modified: `cli-tool/README.md`

**Verification:**
- `node --test tests/scripts/test-runners.test.mjs`
- `npm run test:backend -- tests/scripts/test-runners.test.mjs`
- `npm run test:frontend`
- `npm test`

---

## Task 2: Remove root frontend dependence on `ring-gui/`

**Status:** completed

**Completed slice 2A:** root `dev`, `build`, `preview`, and `typecheck` scripts now proxy to `apps/operator-web`.

**Completed slice 2B:** frontend test runner began executing both legacy `tests/ring-gui/**/*.test.ts` and new v2 `tests/operator-web/**/*.test.ts`, and the first operator-web smoke test landed.

**Completed slice 2C:** root `vite.config.ts`, `tsconfig.json`, and `index.html` now align to `apps/operator-web`, so the duplicate root frontend shell no longer points at `ring-gui/`.

**Completed slice 2D:** legacy `tests/ring-gui/*` coverage has been replaced by operator-web-specific test coverage, the frontend runner now resolves only `tests/operator-web/**/*.test.ts`, and `tests/ring-gui/` has been removed.

**Objective achieved:** The active root frontend + frontend regression dependency edges to `ring-gui` are now severed. Remaining legacy work is outside Stage 2: backend/runtime entrypoints and `tests/ring/*` / `.ring` fixtures.

**Files:**
- Modified: `package.json`
- Modified: `scripts/run-frontend-tests.mjs`
- Modified: `vite.config.ts`
- Modified: `tsconfig.json`
- Modified: `index.html`
- Modified: `apps/operator-web/src/lib/api.ts`
- Modified: `apps/operator-web/tsconfig.json`
- Modified: `tests/scripts/test-runners.test.mjs`
- Created: `tests/scripts/root-frontend-script-alignment.test.mjs`
- Created: `tests/scripts/root-frontend-config-alignment.test.mjs`
- Created: `tests/operator-web/demo-data.test.ts`
- Created: `tests/operator-web/app-shell-navigation.test.ts`
- Created: `tests/operator-web/shared-surface-primitives.test.ts`
- Created: `tests/operator-web/api-fallbacks.test.ts`
- Removed: `tests/ring-gui/`

**Verification completed for slices 2A + 2B + 2C + 2D:**
- `node --test tests/scripts/root-frontend-script-alignment.test.mjs`
- `node --test tests/scripts/root-frontend-config-alignment.test.mjs`
- `node --test tests/scripts/test-runners.test.mjs`
- `node --experimental-strip-types --test tests/operator-web/demo-data.test.ts`
- `node --experimental-strip-types --test tests/operator-web/app-shell-navigation.test.ts`
- `node --experimental-strip-types --test tests/operator-web/shared-surface-primitives.test.ts`
- `node --experimental-strip-types --test tests/operator-web/api-fallbacks.test.ts`
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit`
- `./node_modules/.bin/vite build`
- `npm run typecheck`
- `npm run build`
- `npm run test:frontend`
- `npm test`

---

## Task 3: Replace managed legacy backend entrypoint

**Objective:** Stop `scripts/stack.mjs` from launching `ring/server.mjs`.

**Files:**
- Modify: `scripts/stack.mjs`
- Modify: `scripts/start-with-regression.mjs`
- Replace with v2-backed service path centered on `services/control-api` plus a mature runtime path

**Verification:**
- `npm run stack:verified-restart`
- `npm run stack:status`

---

## Task 4: Remove `.ring` as active runtime/config/state dependency

**Objective:** Eliminate `.ring` from active config discovery, runtime logs, schemas, and test fixtures.

**Files:**
- `ring/` consumers must already be gone before this starts
- Migrate fixtures/tests and runtime state to v2-owned locations

**Verification:**
- full repo regression
- v2 service startup and smoke tests

---

## Task 5: Delete legacy directories

**Objective:** Remove the retired implementation only after all active references are gone.

**Delete candidates:**
- `ring/`
- `.ring/` (or reduce to purely historical/archive content if required)
- `ring-gui/`
- `cli-tool/`

**Verification:**
- `search_files` for no active imports/scripts pointing to those directories
- `npm test`
- managed stack / v2 smoke tests
