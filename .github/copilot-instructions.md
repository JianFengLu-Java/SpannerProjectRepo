<!-- Auto-generated guidance for AI coding agents working on this repository -->
# Copilot instructions — Spanner Project

Purpose: Help AI agents become productive quickly by summarizing architecture, conventions, IPC patterns, and developer workflows used in this Electron + Vue + TypeScript app.

- **High-level architecture**
  - Desktop Electron app with separated main and renderer processes.
  - Main process: Node context, application lifecycle, window management, SQLite DB and IPC handlers. See [src/main/index.ts](src/main/index.ts) and [src/main/controller/setupIpcHandlers.ts](src/main/controller/setupIpcHandlers.ts).
  - Renderer: Vue 3 + TypeScript single-page UI (Pinia for state, Naive UI for components). Entry: [src/renderer/src/main.ts](src/renderer/src/main.ts) and root view [src/renderer/src/App.vue](src/renderer/src/App.vue).
  - Preload: `src/preload/index.ts` exposes a small `window.api` and `window.electron` surface — use these instead of directly importing Electron in renderer.

- **Why this structure**
  - Clear process boundary: business logic and native resources (SQLite) live in main; UI and reactive state live in renderer.
  - IPC handler centralization: all main-side IPC handlers are registered in `setupIpcHandlers.ts` so agents should add/remove channels there.

- **Key integration points & examples**
  - Database service in main: [src/main/database/chatService.ts](src/main/database/chatService.ts) — async wrappers around sqlite3. Example channels handled in main: `db-get-all-chats`, `db-save-message`, `db-get-messages`, `db-set-pinned`.
  - IPC usage patterns: main uses `ipcMain.handle` and `ipcMain.on` in `setupIpcHandlers.ts`; preload exposes APIs in `src/preload/index.ts` (check `electronAPI` from @electron-toolkit/preload).
  - Cross-window store sync: channels `sync-store`, `request-store-data`, `report-store-data` coordinate store hydration between windows.
  - Window lifecycle and singletons are managed in [src/main/windowState/windowManage.ts]. When opening windows prefer those helpers (e.g., `openHomeWindow`, `openChatWindow`).

- **Developer workflows & commands** (from package.json)
  - Dev: `npm run dev` (electron-vite dev)
  - Preview/start: `npm run start` (electron-vite preview)
  - Build: `npm run build` (runs typechecks then electron-vite build)
  - Platform builds: `npm run build:mac|win|linux`
  - Type checking split: `npm run typecheck:node` and `npm run typecheck:web` — CI may run `npm run typecheck` (both).
  - Postinstall: `electron-builder install-app-deps` (native dependency handling). Native modules (sqlite3) require care (electron-rebuild) when changing Electron version.

- **Project-specific conventions**
  - Path aliases: renderer imports use `@renderer/*` — follow tsconfig/alias settings when adding imports.
  - UI platform checks: renderer reads `window.api.platform` (from preload) for platform-specific behavior, e.g., `isWin` checks in `App.vue`.
  - State: `pinia` + `pinia-plugin-persistedstate` — stores are persisted. When adding store-backed data consider existing store patterns in `src/renderer/src/stores/*`.
  - Keep main/renderer separation: do not import Node-only modules into renderer; expose required capabilities via preload or `electronAPI`.

- **When adding IPC channels**
  - Register the main side in `src/main/controller/setupIpcHandlers.ts` using `ipcMain.handle` (for Promise-returning calls) or `ipcMain.on` for events.
  - Expose renderer access via preload. Inspect `src/preload/index.ts` for how `window.api` and `window.electron` are exposed; prefer exposing a small focused API rather than broad `ipcRenderer` usage.

- **Build & native dependency caveats**
  - `sqlite3` is included — changing Electron or node headers may require `npm run postinstall` / `electron-rebuild` / re-running `electron-builder install-app-deps`.
  - Type checking is split between node and web targets (see `tsconfig.node.json` and `tsconfig.web.json`). Use the provided scripts to avoid missing errors.

- **Files to inspect for examples and patterns**
  - [src/main/index.ts](src/main/index.ts) — app lifecycle and window startup
  - [src/main/controller/setupIpcHandlers.ts](src/main/controller/setupIpcHandlers.ts) — all main IPC handlers
  - [src/main/database/chatService.ts](src/main/database/chatService.ts) — DB wrapper patterns
  - [src/preload/index.ts](src/preload/index.ts) — renderer API exposure (contextBridge)
  - [src/renderer/src/main.ts](src/renderer/src/main.ts) and [src/renderer/src/App.vue](src/renderer/src/App.vue) — renderer bootstrapping and theme handling

If anything in this document looks incomplete or you want more detail (example call sites, exact alias mapping, or test commands), tell me what to expand and I'll iterate.
