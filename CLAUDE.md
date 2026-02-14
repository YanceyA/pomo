# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pomo is a local-first Pomodoro timer desktop application built with Tauri v2 + React 19. It combines timer management, task tracking, optional Jira integration, and reporting to support focused work sessions throughout a full working day.

**Target platform:** Windows 10/11 desktop (NSIS installer).

**Current status:** M6 complete — Settings UI (configurable timer durations, presets, persistence). M5 complete (timer-task association). M4 complete (task CRUD, subtasks, drag-and-drop, day scoping, edit/reopen/undo-delete). M3 complete (timer state machine + frontend). M2 complete (SQLite schema v1, TypeScript repository layer). M7 (Jira Integration) is next.

**Reference docs:**
- [pomo-spec.md](./docs/pomo-spec.md) — Functional specification (requirements T-1..T-7, TK-1..TK-13, J-1..J-8, etc.)
- [pomo-tech.md](./docs/pomo-tech.md) — Technical architecture decisions and confirmed stack
- [pomo-dev-plan.md](./docs/pomo-dev-plan.md) — Milestones, PRs, and UAT criteria

## Tech Stack (Installed)

```
Shell:              Tauri v2.10 (Rust backend + WebView2)
Frontend:           React 19.1 + TypeScript 5.8
Build:              Vite 7
Components:         shadcn/ui (Radix primitives + Tailwind CSS v4)
State:              Zustand 5
Drag-and-drop:      @dnd-kit/core 6 + @dnd-kit/sortable 10
Charts:             Chart.js 4 + react-chartjs-2 5
Date navigation:    react-day-picker 9
Forms:              React Hook Form 7 + Zod 4
Styling:            Tailwind CSS v4 (via @tailwindcss/vite plugin)
Toasts:             Sonner 2 (via shadcn/ui)
UI utilities:       class-variance-authority, clsx, tailwind-merge, lucide-react
Packaging:          NSIS installer via Tauri bundler
```

```
Testing:            Vitest 4 + jsdom 28 + React Testing Library 16 + @testing-library/user-event
Coverage:           @vitest/coverage-v8
Linting (TS/JS):    Biome 2
Linting (Rust):     Clippy (pedantic, via .cargo/config.toml)
```

```
Database:           rusqlite 0.32 (bundled, migration runner + Rust tests)
                    tauri-plugin-sql 2 (SQLite, frontend SQL access)
                    @tauri-apps/plugin-sql (npm, TypeScript Database API)
Async runtime:      tokio 1 (rt, time, sync, macros — for timer background task)
Date/time:          chrono 0.4 (ISO 8601 timestamp generation in Rust)
```

### Not Yet Installed (Future Milestones)
```
Audio:              Web Audio API + rodio (Rust fallback) — M10
Jira HTTP:          reqwest (Rust) — M7
Credentials:        keyring crate — M7
MCP:                @anthropic-ai/mcp-server-sqlite — M10
```

## Project Structure (Actual)

```
pomo/
├── docs/                       # Spec, tech decisions, dev plan
├── src/                        # React frontend
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx      # shadcn/ui Button component
│   │   │   ├── badge.tsx       # shadcn/ui Badge component
│   │   │   ├── checkbox.tsx    # shadcn/ui Checkbox component
│   │   │   ├── dialog.tsx      # shadcn/ui Dialog component
│   │   │   ├── input.tsx       # shadcn/ui Input component
│   │   │   ├── label.tsx       # shadcn/ui Label component
│   │   │   ├── calendar.tsx    # shadcn/ui Calendar component (react-day-picker v9)
│   │   │   ├── popover.tsx     # shadcn/ui Popover component (Radix)
│   │   │   ├── sheet.tsx       # shadcn/ui Sheet component (Radix Dialog)
│   │   │   ├── slider.tsx     # shadcn/ui Slider component (Radix)
│   │   │   └── sonner.tsx     # shadcn/ui Sonner toast component
│   │   ├── TimerPage.tsx       # Main timer page — combines display, controls, selector
│   │   ├── TimerDisplay.tsx    # Large countdown (MM:SS) with SVG progress ring
│   │   ├── TimerControls.tsx   # Start, Pause/Resume, Cancel buttons
│   │   ├── IntervalTypeSelector.tsx  # Work / Short Break / Long Break radio group
│   │   ├── DateNavigator.tsx   # Day picker with prev/next arrows, calendar popover, Today button
│   │   ├── IntervalAssociationDialog.tsx  # Post-interval dialog to link tasks to completed pomodoro
│   │   ├── SettingsPanel.tsx   # Settings sheet with timer durations, presets, validation
│   │   ├── TaskList.tsx        # Day's task list with DateNavigator, DndContext, drag-and-drop reordering
│   │   ├── TaskPanel.tsx       # Sortable task card with drag handle, status, tag, subtasks, actions
│   │   ├── TaskPanelOverlay.tsx # Simplified task card for drag overlay preview
│   │   ├── TaskCreateDialog.tsx # Dialog for creating tasks and subtasks
│   │   ├── SubtaskItem.tsx     # Compact subtask row with checkbox and delete
│   │   └── __tests__/          # Component tests (mock Tauri APIs via vi.mock)
│   ├── stores/
│   │   ├── timerStore.ts       # Zustand store for timer state, Tauri event subscriptions
│   │   ├── taskStore.ts        # Zustand store for task CRUD, day selection, dialog state
│   │   └── __tests__/          # Store tests
│   ├── lib/
│   │   ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   │   ├── db.ts               # Database singleton (tauri-plugin-sql)
│   │   ├── schemas.ts          # Zod schemas + TypeScript types for all domain entities
│   │   ├── settingsRepository.ts     # CRUD for user_settings table
│   │   ├── intervalsRepository.ts    # CRUD for timer_intervals table
│   │   ├── tasksRepository.ts        # CRUD for tasks table (incl. clone, copyToDay)
│   │   ├── taskIntervalLinksRepository.ts  # CRUD for task_interval_links table
│   │   └── __tests__/          # Repository + schema tests (mock DB via vi.mock)
│   ├── App.tsx                 # Root component — renders TimerPage
│   ├── App.test.tsx            # Smoke test — app renders heading + start button
│   ├── test-setup.ts           # Vitest setup — jest-dom matchers
│   ├── main.tsx                # React entry point
│   ├── index.css               # Tailwind CSS v4 + shadcn/ui theme variables
│   └── vite-env.d.ts           # Vite type declarations
├── src-tauri/                  # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs             # Windows entry point → pomo_lib::run()
│   │   ├── lib.rs              # Tauri app builder, DB init + timer/task state in setup hook, smoke test
│   │   ├── timer.rs            # Timer state machine, Tauri commands, background tick task
│   │   ├── tasks.rs            # Task CRUD Tauri commands (create, update, delete, complete, abandon, clone, reorder)
│   │   └── database.rs         # SQLite migration runner, schema v1, cloud-sync detection
│   ├── .cargo/
│   │   └── config.toml         # Clippy lint configuration (pedantic)
│   ├── capabilities/
│   │   └── default.json        # Tauri capability permissions
│   ├── icons/                  # App icons (various sizes)
│   ├── build.rs                # Tauri build script
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri config (app name, window size, bundling)
├── public/                     # Static assets served by Vite
├── .github/
│   └── workflows/
│       └── ci.yml              # CI pipeline: lint → typecheck → vitest → clippy → cargo test → build
├── CLAUDE.md                   # This file
├── biome.json                  # Biome config (linter + formatter, Tailwind CSS support)
├── vitest.config.ts            # Vitest config (jsdom, v8 coverage, path aliases)
├── components.json             # shadcn/ui configuration
├── tsconfig.json               # TypeScript config (strict, path aliases: @/ → src/)
├── tsconfig.node.json          # TypeScript config for Vite/Node files
├── vite.config.ts              # Vite config (React, Tailwind, path aliases)
├── package.json                # npm scripts and dependencies
└── index.html                  # HTML entry point
```

## Build & Run Commands

```bash
# Development
npm run tauri dev            # Launch app in dev mode (Vite HMR + Rust backend)
npm run dev                  # Start Vite dev server only (no Tauri)

# Frontend checks
npm run typecheck            # tsc --noEmit
npm run build                # tsc && vite build (production frontend build)

# Backend (from src-tauri/)
cargo check                  # Fast Rust compile check
cargo build                  # Full Rust build

# Production build
npm run tauri build          # Build NSIS installer
```

### Testing & Linting
```bash
npm run test                 # Vitest (run once)
npm run test:watch           # Vitest (watch mode)
npm run test:coverage        # Vitest + v8 coverage
npm run lint                 # Biome check (lint + format)
npm run lint:fix             # Biome auto-fix (lint + format)
cargo test                   # Rust tests (from src-tauri/)
cargo clippy -- -D warnings  # Clippy (from src-tauri/)
```

### CI Pipeline (.github/workflows/ci.yml)
Two jobs: `lint-and-test` then `build`.
- Biome lint → TypeScript typecheck → Vitest → Clippy → cargo test → cargo tauri build

### Rust Testing Notes
- Tauri's `common-controls-v6` default feature is disabled to allow `cargo test` on Windows (causes `STATUS_ENTRYPOINT_NOT_FOUND` in test binaries).
- Tests use `tauri::test::mock_builder()` with `MockRuntime` instead of real WebView2.
- The `test` feature is enabled on the `tauri` dependency.
- Database tests use `rusqlite::Connection::open_in_memory()` with `PRAGMA foreign_keys = ON` for full schema validation (26 tests covering migrations, tables, indexes, trigger, settings, constraints, foreign keys, and cloud path detection).
- Timer tests (32 tests) cover: state machine transitions, invalid transition rejection, work count tracking, long break reset, serde roundtrip, DB interval operations (insert/complete/cancel), and full lifecycle cycles.
- Task tests (24 tests) cover: CRUD operations, subtask creation, parent completion constraints (pending subtasks block completion, abandoned subtasks allow completion), status transitions, cloning with deep subtask copy, reorder position updates, serde roundtrip, reopen from completed/abandoned, reopen-when-pending error, and delete guard for completed/abandoned tasks.
- Task-interval link tests (5 tests) cover: link creation, batch linking, INSERT OR IGNORE deduplication, interval count query with correct data, and day-scoped filtering.
- Current Rust test count: 91 (29 database + 32 timer + 29 task + 1 app build smoke).

### Frontend Testing Notes
- Repository tests mock the `../db` module with `vi.mock()` to avoid Tauri IPC calls.
- Mock DB (`__tests__/db.mock.ts`) provides `MockDatabase` with `select`, `execute`, and `close` mock functions.
- Each test file must call `vi.mock("../db", ...)` before importing the repository module (use dynamic `await import()`).
- Zod schema tests validate both well-formed data acceptance and malformed data rejection.
- Component and store tests mock `@tauri-apps/api/core` (invoke), `@tauri-apps/api/event` (listen), and `@/lib/settingsRepository` via `vi.mock()`.
- Timer store tests verify state transitions, event handling, and Tauri command invocations.
- Component tests use `@testing-library/user-event` for user interaction simulation.
- Task store tests verify CRUD command invocations, date selection, dialog state management, edit dialog state, soft delete/undo flow, and reopen task.
- Task component tests (TaskPanel, TaskCreateDialog, SubtaskItem) verify rendering of all fields, user interactions (checkbox, actions menu, form submit), correct command invocations, edit mode, toggle completion/reopen, delete guards for completed/abandoned, soft delete (no immediate invoke), inline subtask editing, and undo toast flow.
- DateNavigator tests verify: "Today" rendering, formatted date for non-today, Today button visibility, past-day indicator, prev/next day navigation with store updates, calendar popover open/close, and calendar date selection.
- IntervalAssociationDialog tests (9 tests) cover: dialog visibility, empty task state, parent-only task filtering, checkbox toggle, confirm button disabled state, link command invocation, skip dismissal, and post-confirm reload.
- SettingsPanel tests (10 tests) cover: trigger rendering, sheet open/close, loading values from repository, saving all settings to repository, reloading timer settings after save, preset button application (25/5, 35/7), timer-active warning display, and sheet auto-close on save.
- Current test count: 192 Vitest tests (14 schema + 4 settings + 4 intervals + 13 tasks + 3 links + 2 app smoke + 19 timer store + 23 task store + 8 timer display + 8 timer controls + 7 interval type selector + 24 task panel + 14 task create dialog + 15 subtask item + 4 task list + 11 date navigator + 9 interval association dialog + 10 settings panel).

## Architecture Notes

### Timer System (Implemented — PR 3.1)
- Timer state machine in `src-tauri/src/timer.rs` with `TimerState` (Idle, Running, Paused) and `IntervalType` (Work, ShortBreak, LongBreak) enums.
- Runs as a Tokio async task in the Rust backend — never in the frontend (webview throttling breaks timers when minimized).
- Uses wall-clock end time (`Instant`), not a countdown. Remaining time computed from `Instant::now()` on each tick (250ms interval via `tokio::time::interval`).
- Timer emits `timer-tick` and `timer-complete` events to the frontend via Tauri's event system (`app.emit()`).
- States: `Idle → Running → Paused → Running → Idle` (on complete or cancel).
- Tauri commands: `start_timer`, `pause_timer`, `resume_timer`, `cancel_timer`, `get_timer_state` — all registered in `lib.rs` invoke handler.
- Commands are generic over `R: Runtime` so they work with both `Wry` (production) and `MockRuntime` (tests).
- `AppState` (containing `Mutex<TimerInner>` + DB path) managed via `app.manage()` in the setup hook.
- On start: creates `in_progress` interval row in `timer_intervals` table. On complete: updates to `completed` with `end_time` and `duration_seconds`. On cancel: updates to `cancelled`.
- Tracks `completed_work_count`: incremented after work interval, reset after long break, unchanged after short break or cancel. Frontend uses this to suggest long breaks.
- Background tick task spawned via `tauri::async_runtime::spawn()`, self-terminating when timer state is no longer Running.
- `#[allow(clippy::needless_pass_by_value)]` on all Tauri commands — `tauri::State` must be passed by value per Tauri's API.
- Timers and tasks are loosely coupled — association happens after a work interval completes via a checkbox dialog (PR 5.1).

### Timer Frontend (Implemented — PR 3.2)
- **Zustand store** (`src/stores/timerStore.ts`): manages all timer state on the frontend. Subscribes to `timer-tick` and `timer-complete` Tauri events via `listen()`. Invokes Tauri commands (`start_timer`, `pause_timer`, `resume_timer`, `cancel_timer`, `get_timer_state`) via `invoke()`. Loads settings from `settingsRepository.getAll()`.
- **TimerDisplay** (`src/components/TimerDisplay.tsx`): large MM:SS countdown with SVG progress ring. Color-coded by interval type (primary for work, emerald for short break, blue for long break). Shows planned duration when idle, remaining time when active.
- **TimerControls** (`src/components/TimerControls.tsx`): Start button when idle; Pause/Resume + Cancel when active. Uses shadcn/ui Button with lucide-react icons.
- **IntervalTypeSelector** (`src/components/IntervalTypeSelector.tsx`): radio group for Work/Short Break/Long Break. Disabled during active timer. Shows duration label under each option.
- **TimerPage** (`src/components/TimerPage.tsx`): main page combining all timer components. Shows "Pomodoro X of Y" count. Displays completion notice with contextual messages (suggests long break after N work intervals). Initializes event listeners and loads settings on mount.
- **Event flow**: TimerPage `useEffect` → `loadSettings()` + `syncState()` + `initEventListeners()`. Tick events update `remainingMs` in store. Complete events reset to idle and show completion notice.

### Task Management (Implemented — PR 4.1)
- Tauri commands in `src-tauri/src/tasks.rs`: `create_task`, `update_task`, `delete_task`, `complete_task`, `abandon_task`, `reopen_task`, `get_tasks_by_date`, `clone_task`, `reorder_tasks`, `link_tasks_to_interval`, `get_task_interval_counts`.
- Commands open their own DB connection with `PRAGMA foreign_keys = ON` (not sharing the timer's connection).
- `complete_task` validates no pending subtasks exist before allowing parent completion — returns error if blocked.
- `clone_task` deep copies the task and all its subtasks with fresh IDs and `pending` status.
- Task auto-positioning: `create_task` computes the next position as `MAX(position) + 1` for the day.
- **Zustand store** (`src/stores/taskStore.ts`): manages task list, selected date, create/edit dialog state, pending delete (undo toast). Actions: `reopenTask`, `softDeleteTask`, `undoDelete`, `openEditDialog`, `closeEditDialog` in addition to CRUD. All actions call Tauri commands via `invoke()` then reload the task list.
- **DateNavigator** (`src/components/DateNavigator.tsx`): date navigation with prev/next day buttons, calendar popover (shadcn/ui Calendar + Popover using react-day-picker v9), "Today" button when viewing non-today dates, and "Viewing a past day" indicator. Connects to `taskStore.setSelectedDate()`.
- **TaskList** (`src/components/TaskList.tsx`): renders DateNavigator, add button, and sortable TaskPanel for each parent task. Uses `DndContext` + `SortableContext` with `verticalListSortingStrategy` for drag-and-drop. `PointerSensor` (distance: 8) and `KeyboardSensor` with `sortableKeyboardCoordinates`. `DragOverlay` renders `TaskPanelOverlay` during drag.
- **TaskPanel** (`src/components/TaskPanel.tsx`): sortable task card using `useSortable` hook. Drag handle via `setActivatorNodeRef` on GripVertical icon button. Applies `CSS.Transform` and `transition` styles. Displays title, tag badge, Jira key, status indicator, subtask list, and expandable action menu.
- **TaskPanelOverlay** (`src/components/TaskPanelOverlay.tsx`): simplified task card for drag overlay preview — shows title, tag badge, subtask count.
- **TaskCreateDialog** (`src/components/TaskCreateDialog.tsx`): shadcn/ui Dialog for creating and editing tasks (title, tag, Jira key) and subtasks (title only). Edit mode pre-populates fields and calls `updateTask` on submit.
- **SubtaskItem** (`src/components/SubtaskItem.tsx`): compact checkbox + title row for subtasks with complete, reopen, inline edit (pencil icon → input, Enter/blur saves, Escape cancels), and soft delete with undo toast.
- Status transitions: pending → completed (with subtask check), pending → abandoned, completed → pending (reopen), abandoned → pending (reopen).
- Delete guard: completed/abandoned tasks cannot be deleted (backend rejects, UI hides delete button). Must reopen first.
- Soft delete with undo: delete removes task from UI immediately, shows Sonner toast with "Undo" button (10s timeout). Actual backend delete fires after timeout. Undo cancels the timeout and reloads tasks.
- App layout updated: `App.tsx` renders `<TimerPage />` + `<TaskList />` in a vertical stack.

### Timer-Task Association (Implemented — PR 5.1)
- After a **work** interval completes, the `timer-complete` event triggers an association dialog in the frontend.
- **Break** intervals (short/long) skip the dialog entirely — `showAssociationDialog` stays false.
- The `IntervalAssociationDialog` component shows all parent tasks for the current day with checkboxes. User selects which tasks they worked on during the pomodoro.
- On confirm: calls `link_tasks_to_interval` Rust command which batch-inserts into `task_interval_links` using `INSERT OR IGNORE` (UNIQUE constraint prevents duplicates).
- On skip: dialog dismisses without any linking.
- **Timer store** (`timerStore.ts`) manages dialog state: `showAssociationDialog`, `lastCompletedIntervalId`, `showAssociation()`, `dismissAssociationDialog()`.
- **Task store** (`taskStore.ts`) loads interval counts alongside tasks via `get_task_interval_counts` Rust command (joined query on `task_interval_links`). Stored as `intervalCounts: Record<number, number>`.
- **TaskPanel** displays linked pomodoro count (e.g., "2 pomodoros") with a clock icon when `intervalCounts[task.id] > 0`.
- Rust commands: `link_tasks_to_interval(task_ids, interval_id)`, `get_task_interval_counts(day_date)` — registered in `lib.rs`.
- Tasks remain independently completable — association does not auto-complete tasks (G-4, TK-12).

### Settings (Implemented — PR 6.1)
- **SettingsPanel** (`src/components/SettingsPanel.tsx`): shadcn/ui Sheet (slide-out panel) triggered by a gear icon in the top-right corner.
- Settings form with number inputs: work duration (1-60 min), short break (1-30 min), long break (5-60 min), long break frequency (1-10 pomodoros).
- Preset buttons: "25 / 5" (classic pomodoro) and "35 / 7" (extended focus).
- On open: loads current values from `user_settings` table via `settingsRepository.getAll()`.
- On save: validates with `clamp()` + integer checks, writes each setting via `settingsRepository.set()`, calls `timerStore.loadSettings()` to sync, closes the sheet.
- Shows "Changes will apply to the next interval" warning when timer is active.
- DB settings keys: `work_duration_minutes`, `short_break_duration_minutes`, `long_break_duration_minutes`, `long_break_frequency` — stored as string values of integers (minutes).
- Timer store `loadSettings()` reads `_minutes` keys and converts to seconds (e.g., `25` → `1500`).

### Database
- SQLite with 4 tables: `user_settings`, `timer_intervals`, `tasks`, `task_interval_links`.
- Schema managed via `PRAGMA user_version` (currently v1). Migration runner in `src-tauri/src/database.rs`.
- `PRAGMA foreign_keys = ON` set on every connection.
- WAL mode for local paths; `journal_mode=DELETE` for cloud-synced paths (OneDrive/Dropbox/Google Drive/iCloud) — auto-detected by `is_cloud_synced_path()`.
- DB file created at `$APPDATA/com.pomo.app/pomo.db` on first launch (Tauri setup hook).
- `tauri-plugin-sql` registered for frontend SQL access via `@tauri-apps/plugin-sql` npm package.
- TypeScript repository layer (`src/lib/*Repository.ts`) provides typed wrappers around `db.select<T>()` and `db.execute()`.
- Zod schemas (`src/lib/schemas.ts`) validate all DB results at runtime; types inferred via `z.infer<>`.
- `rusqlite` (bundled) used for the Rust-side migration runner and backend tests.
- Tasks support one level of subtasks via `parent_task_id` (enforced by `enforce_single_level_subtasks` trigger).
- Cross-day task copies linked via `linked_from_task_id` (SET NULL on delete).
- All timestamps are ISO 8601 UTC text.
- Default settings seeded on first run: work=25min, short break=5min, long break=15min, frequency=4, Jira disabled.

### Jira Integration
- Read-only integration — no data is written back to Jira.
- HTTP requests made from Rust backend (reqwest) to avoid CORS.
- Supports Jira Cloud (API token) and Jira Server/DC (PAT).
- Graceful degradation: API unavailable → save link unverified with UI note.
- API validation can be toggled off entirely in settings.

### Frontend Patterns
- **Path aliases:** `@/` maps to `./src/` (configured in tsconfig.json and vite.config.ts).
- **Tailwind CSS v4:** Uses `@tailwindcss/vite` plugin — no `tailwind.config.ts` file. Theme configured in `src/index.css` using `@theme` directives.
- **shadcn/ui:** Components in `src/components/ui/`. Add new components with `npx shadcn@latest add <name>`. Config in `components.json`.
- **Zustand stores:** `src/stores/timerStore.ts` manages timer state. Stores use selectors (`useTimerStore((s) => s.field)`) for render optimization. Actions are async functions that call `invoke()` and update state from the `TimerStatus` response.
- **Tauri event subscriptions:** Use `listen<PayloadType>("event-name", callback)` from `@tauri-apps/api/event`. Register in `useEffect`, call returned unlisten function on cleanup.
- **Repository pattern:** Typed wrappers in `src/lib/*Repository.ts` around `tauri-plugin-sql` `execute`/`select` calls (no ORM). SQL uses `$1, $2, $3` positional parameters.
- **Zod validation:** All DB query results validated via Zod schemas in `src/lib/schemas.ts`. Domain types (`Task`, `TimerInterval`, `Setting`, `TaskIntervalLink`) inferred from schemas.
- **DB singleton:** `src/lib/db.ts` exports `getDb()` which lazily connects to `sqlite:pomo.db` via `Database.load()`.
- **Test mocking:** Repository tests mock `../db` module via `vi.mock()` in each test file, with shared mock helpers in `__tests__/db.mock.ts`. Repository modules must be imported dynamically after `vi.mock()` setup: `const repo = await import("../repository")`.

## Development Plan (10 Milestones)

1. **M1: Scaffolding** — Tauri + React + tooling setup, CI pipeline
2. **M2: Database** — SQLite schema, migrations, TypeScript repository layer
3. **M3: Timer** — Rust state machine + frontend timer UI
4. **M4: Tasks** — CRUD, subtasks, drag-and-drop, day scoping
5. **M5: Timer-Task Link** — Post-interval task association dialog
6. **M6: Settings** — Configurable durations, presets, persistence
7. **M7: Jira** — Credential storage, ticket validation, task linking
8. **M8: Task History** — Past day review, copy tasks forward
9. **M9: Reporting** — Daily/weekly/monthly summaries, visual timeline
10. **M10: Polish** — Audio, MCP docs, UI polish, installer

Branch naming: `feat/M{n}-{description}` (e.g., `feat/M1-scaffolding`). All PRs target `main`.

## Key Conventions

- **No ORMs** — raw SQL with typed wrappers. The Tauri plugin expects raw SQL strings.
- **Backend timer, frontend display** — timer logic always in Rust, UI subscribes to events.
- **ISO 8601 UTC** for all timestamps in the database.
- **Single-level subtasks only** — enforced at both DB trigger and app level.
- **Day-scoped tasks** — every task belongs to a specific calendar day (YYYY-MM-DD).
- **Biome** for TS/JS linting and formatting (not ESLint/Prettier).
- **Clippy** for Rust linting.
- **shadcn/ui** components added via CLI (`npx shadcn@latest add <name>`), not manually created.

## Keeping This File Updated

This CLAUDE.md should be updated when:
- New dependencies are added or removed
- Project structure changes (new directories, renamed files)
- Build/run commands change
- Architectural patterns are established or modified
- New conventions are adopted
