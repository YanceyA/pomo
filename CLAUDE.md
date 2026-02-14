# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pomo is a local-first Pomodoro timer desktop application built with Tauri v2 + React 19. It combines timer management, task tracking, optional Jira integration, and reporting to support focused work sessions throughout a full working day.

**Target platform:** Windows 10/11 desktop (NSIS installer).

**Current status:** M10 PR 10.1 complete — Alarm audio (chime WAV, Web Audio API + rodio fallback, volume setting, test button). M9 complete — PR 9.1 Reports page with daily/weekly summaries; PR 9.2 daily visual timeline and monthly view. M8 PR 8.1 complete — Past day review and task copying (calendar dot indicators, copy-to-today, copied-from indicator). M6 complete (settings UI). M5 PR 5.2 complete — UAT fixes (dialog redesign, completed_in_pomodoro, break overtime, auto-dismiss). M4 complete (task CRUD, subtasks, drag-and-drop, day scoping, edit/reopen/undo-delete). M3 complete (timer state machine + frontend). M2 complete (SQLite schema v2, TypeScript repository layer). M7 (Jira Integration) skipped due to IT/tech blockers.

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
Charts:             Chart.js 4 + react-chartjs-2 5 + chartjs-adapter-date-fns
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
Audio:              Web Audio API (HTMLAudioElement) + rodio 0.19 (Rust fallback, WAV only)
```

### Not Yet Installed (Future Milestones)
```
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
│   │   │   ├── sonner.tsx     # shadcn/ui Sonner toast component
│   │   │   └── tabs.tsx       # shadcn/ui Tabs component (Radix)
│   │   ├── TimerPage.tsx       # Main timer page — combines display, controls, selector
│   │   ├── TimerDisplay.tsx    # Large countdown (MM:SS) with SVG progress ring
│   │   ├── TimerControls.tsx   # Start, Pause/Resume, Cancel buttons
│   │   ├── IntervalTypeSelector.tsx  # Work / Short Break / Long Break radio group
│   │   ├── DateNavigator.tsx   # Day picker with prev/next arrows, calendar popover, Today button
│   │   ├── IntervalAssociationDialog.tsx  # Post-interval dialog to link tasks to completed pomodoro
│   │   ├── SettingsPanel.tsx   # Settings sheet with timer durations, presets, volume slider, validation
│   │   ├── TaskList.tsx        # Day's task list with DateNavigator, DndContext, drag-and-drop reordering
│   │   ├── TaskPanel.tsx       # Sortable task card with drag handle, status, tag, subtasks, actions
│   │   ├── TaskPanelOverlay.tsx # Simplified task card for drag overlay preview
│   │   ├── TaskCreateDialog.tsx # Dialog for creating tasks and subtasks
│   │   ├── SubtaskItem.tsx     # Compact subtask row with checkbox and delete
│   │   ├── ReportsPage.tsx     # Reports page with Daily/Weekly/Monthly tabs
│   │   ├── DailySummary.tsx    # Daily report: stats, timeline, interval list, task groups
│   │   ├── DailyTimeline.tsx   # Horizontal bar chart showing work/break intervals at actual times
│   │   ├── WeeklySummary.tsx   # Weekly report: stats, bar chart, daily breakdown, task groups
│   │   ├── MonthlySummary.tsx  # Monthly report: stats, bar chart, weekly breakdown
│   │   └── __tests__/          # Component tests (mock Tauri APIs via vi.mock)
│   ├── stores/
│   │   ├── timerStore.ts       # Zustand store for timer state, Tauri event subscriptions
│   │   ├── taskStore.ts        # Zustand store for task CRUD, day selection, dialog state
│   │   ├── reportStore.ts      # Zustand store for report tab, daily/weekly summary state
│   │   └── __tests__/          # Store tests
│   ├── lib/
│   │   ├── audio.ts            # Alarm chime playback (Web Audio API + Rust fallback)
│   │   ├── utils.ts            # cn() utility (clsx + tailwind-merge)
│   │   ├── db.ts               # Database singleton (tauri-plugin-sql)
│   │   ├── schemas.ts          # Zod schemas + TypeScript types for all domain entities
│   │   ├── settingsRepository.ts     # CRUD for user_settings table
│   │   ├── intervalsRepository.ts    # CRUD for timer_intervals table
│   │   ├── tasksRepository.ts        # CRUD for tasks table (incl. clone, copyToDay)
│   │   ├── taskIntervalLinksRepository.ts  # CRUD for task_interval_links table
│   │   └── __tests__/          # Repository + schema tests (mock DB via vi.mock)
│   ├── App.tsx                 # Root component — Timer/Reports view switching
│   ├── App.test.tsx            # Smoke test — app renders heading + start button
│   ├── test-setup.ts           # Vitest setup — jest-dom matchers + ResizeObserver polyfill
│   ├── main.tsx                # React entry point
│   ├── index.css               # Tailwind CSS v4 + shadcn/ui theme variables
│   └── vite-env.d.ts           # Vite type declarations
├── src-tauri/                  # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs             # Windows entry point → pomo_lib::run()
│   │   ├── lib.rs              # Tauri app builder, DB init + timer/task state in setup hook, smoke test
│   │   ├── timer.rs            # Timer state machine, Tauri commands, background tick task
│   │   ├── tasks.rs            # Task CRUD Tauri commands (create, update, delete, complete, abandon, clone, reorder)
│   │   ├── reports.rs          # Report Tauri commands (get_daily_summary, get_weekly_summary)
│   │   ├── audio.rs            # Alarm audio playback via rodio (Rust fallback for Web Audio)
│   │   └── database.rs         # SQLite migration runner, schema v1-v3, cloud-sync detection
│   ├── .cargo/
│   │   └── config.toml         # Clippy lint configuration (pedantic)
│   ├── capabilities/
│   │   └── default.json        # Tauri capability permissions
│   ├── icons/                  # App icons (various sizes)
│   ├── build.rs                # Tauri build script
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri config (app name, window size, bundling)
├── public/                     # Static assets served by Vite
│   └── sounds/
│       └── chime.wav           # Alarm chime audio (two-tone bell, ~0.8s, 16-bit mono PCM)
├── scripts/
│   └── generate-chime.mjs      # Node.js script to regenerate chime WAV file
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
- Database tests use `rusqlite::Connection::open_in_memory()` with `PRAGMA foreign_keys = ON` for full schema validation (28 tests covering migrations v1-v3, tables, indexes, trigger, settings, constraints, foreign keys, and cloud path detection).
- Timer tests (32 tests) cover: state machine transitions, invalid transition rejection, work count tracking, long break reset, serde roundtrip, DB interval operations (insert/complete/cancel), and full lifecycle cycles.
- Task tests (24 tests) cover: CRUD operations, subtask creation, parent completion constraints (pending subtasks block completion, abandoned subtasks allow completion), status transitions, cloning with deep subtask copy, reorder position updates, serde roundtrip, reopen from completed/abandoned, reopen-when-pending error, and delete guard for completed/abandoned tasks.
- Task-interval link tests (5 tests) cover: link creation, batch linking, INSERT OR IGNORE deduplication, interval count query with correct data, and day-scoped filtering.
- Copy-to-day tests (4 tests) cover: linked task creation with correct `linked_from_task_id`, deep subtask copy to target day, original task unchanged, and position at end of target day.
- Days-with-tasks tests (3 tests) cover: distinct date aggregation, subtask exclusion, and date range filtering.
- Origin dates tests (1 test) cover: INNER JOIN returning correct origin day_date for copied tasks.
- Report tests (15 tests) cover: empty day summary, work-only pomodoro counting, interval chronological ordering, task counts excluding subtasks, jira key grouping with NULLS LAST, day exclusion, empty week, cross-day weekly aggregation, week-spanning task groups, subtask exclusion from groups, cancelled interval exclusion, monthly empty, monthly multi-week aggregation, monthly boundary clipping, monthly correct week count.
- Audio tests (2 tests) cover: WAV file header validation (RIFF/WAVE magic bytes), volume clamping (0.0–1.0 range).
- Current Rust test count: 129 (34 database + 37 timer + 40 task + 15 reports + 2 audio + 1 app build smoke).

### Frontend Testing Notes
- Repository tests mock the `../db` module with `vi.mock()` to avoid Tauri IPC calls.
- Mock DB (`__tests__/db.mock.ts`) provides `MockDatabase` with `select`, `execute`, and `close` mock functions.
- Each test file must call `vi.mock("../db", ...)` before importing the repository module (use dynamic `await import()`).
- Zod schema tests validate both well-formed data acceptance and malformed data rejection.
- Component and store tests mock `@tauri-apps/api/core` (invoke), `@tauri-apps/api/event` (listen), and `@/lib/settingsRepository` via `vi.mock()`.
- Timer store tests verify state transitions, event handling, Tauri command invocations, and alarm audio playback on timer completion (plays at configured volume, skips when volume is 0, loads volume from settings).
- Component tests use `@testing-library/user-event` for user interaction simulation.
- Task store tests verify CRUD command invocations, date selection, dialog state management, edit dialog state, soft delete/undo flow, reopen task, copy-to-day, load days with tasks, and origin date loading.
- Task component tests (TaskPanel, TaskCreateDialog, SubtaskItem) verify rendering of all fields, user interactions (checkbox, actions menu, form submit), correct command invocations, edit mode, toggle completion/reopen, delete guards for completed/abandoned, soft delete (no immediate invoke), inline subtask editing, undo toast flow, copy-to-today visibility/invocation, and copied-from origin indicator display/hiding.
- DateNavigator tests verify: "Today" rendering, formatted date for non-today, Today button visibility, past-day indicator, prev/next day navigation with store updates, calendar popover open/close, calendar date selection, and loading days with tasks on calendar open.
- IntervalAssociationDialog tests (17 tests) cover: dialog visibility, empty task state, pending-only task filtering (completed/abandoned excluded), subtask rendering nested under parents, subtask-not-as-parent, checkbox toggle, parent auto-check/uncheck cascading, all-subtasks auto-check parent, confirm button disabled, complete_task invocations (subtasks before parents), pomodoroNumber passing, link_tasks_to_interval, skip dismissal, post-confirm reload.
- SettingsPanel tests (17 tests) cover: trigger rendering, sheet open/close, loading values from repository, saving all settings to repository, reloading timer settings after save, preset button application (25/5, 35/7), timer-active warning display, sheet auto-close on save, break overtime checkbox rendering, break overtime setting save, alarm volume slider rendering, volume percentage display, test alarm button rendering, test button playAlarmChime invocation, alarm volume setting save.
- Audio tests (5 tests) cover: web audio playback with correct volume, multiple repetitions with gaps, volume clamping (0-1), fallback to Rust backend on web audio failure, fallback on play() rejection.
- Report store tests (18 tests) cover: default tab, tab switching, loadDailySummary with correct params, explicit date param, setDailyDate, prevDay, nextDay, error handling, loadWeeklySummary, prevWeek, nextWeek, weekly error handling, loadMonthlySummary, explicit month param, setMonthStart, prevMonth, nextMonth, monthly error handling.
- ReportsPage tests (5 tests) cover: heading rendering, tab rendering, default daily active, weekly tab switch, monthly tab switch.
- DailySummary tests (15 tests) cover: pomodoro count, focus time, tasks ratio, interval types, jira key groups, tag badge, pomodoro indicator, Today display, Today button visibility/hiding, prev day navigation, loading state, empty intervals, empty tasks, timeline chart rendering.
- WeeklySummary tests (11 tests) cover: total pomodoros, focus time, tasks completed, bar chart (mocked), daily breakdown, jira key groups, tag badge, prev week navigation, loading state, empty tasks, This Week button.
- DailyTimeline tests (5 tests) cover: chart renders, empty state, dataset count, dataset labels, data-testid.
- MonthlySummary tests (8 tests) cover: total pomodoros, focus time, tasks completed, bar chart (mocked), weekly breakdown section, prev month navigation, loading state, This Month button.
- Current test count: 296 Vitest tests (14 schema + 4 settings + 4 intervals + 13 tasks + 3 links + 2 app smoke + 28 timer store + 27 task store + 18 report store + 10 timer display + 10 timer controls + 7 interval type selector + 28 task panel + 14 task create dialog + 15 subtask item + 4 task list + 12 date navigator + 17 interval association dialog + 17 settings panel + 5 audio + 5 reports page + 15 daily summary + 11 weekly summary + 5 daily timeline + 8 monthly summary).

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

### Timer-Task Association (Implemented — PR 5.1, updated PR 5.2)
- After a **work** interval completes, the `timer-complete` event triggers an association dialog in the frontend.
- **Break** intervals (short/long) skip the dialog entirely — `showAssociationDialog` stays false.
- The `IntervalAssociationDialog` component (PR 5.2 redesign) shows "Complete Tasks" — only pending parent tasks and their pending subtasks. Completed/abandoned items are filtered out.
- Checkbox cascading: checking parent auto-checks all subtasks; unchecking parent unchecks all; checking all subtasks auto-checks parent; unchecking one subtask unchecks parent.
- On confirm: completes selected tasks (subtasks first, then parents) via `invoke("complete_task", { id, pomodoroNumber: completedWorkCount })`, links to interval via `link_tasks_to_interval`, reloads tasks.
- On skip: dialog dismisses without any changes.
- **Timer store** (`timerStore.ts`) manages dialog state: `showAssociationDialog`, `lastCompletedIntervalId`, `showAssociation()`, `dismissAssociationDialog()`.
- **Task store** (`taskStore.ts`) loads interval counts alongside tasks via `get_task_interval_counts` Rust command. `completeTask(id, pomodoroNumber?)` passes optional pomodoro number to backend.
- **TaskPanel** displays "Pomodoro N" with clock icon when `task.completed_in_pomodoro != null && > 0`.
- **`completed_in_pomodoro`** column (migration v2): stores which pomodoro number a task was completed in. Cleared to NULL on reopen.
- Rust commands: `link_tasks_to_interval(task_ids, interval_id)`, `get_task_interval_counts(day_date)`, `copy_task_to_day(id, target_date)`, `get_days_with_tasks(start_date, end_date)`, `get_task_origin_dates(day_date)` — registered in `lib.rs`.

### Break Overtime (Implemented — PR 5.2)
- Optional feature toggled by `break_overtime_enabled` setting (default: false).
- When enabled, break timers count up past zero after completion, showing `-MM:SS` in amber.
- **Rust state machine:** `TimerInner` has `overtime`, `break_overtime_enabled`, `overtime_start` fields. On break completion with overtime enabled: completes interval in DB (planned duration), enters overtime mode, emits `timer-complete` with `overtime: true`, continues ticking with `overtime_ms`. Cancel during overtime resets to idle without DB write (already completed).
- **Frontend:** Timer store tracks `overtime`, `overtimeMs`, `breakOvertimeEnabled`. `TimerDisplay` shows negative time in `text-amber-500`. `TimerControls` shows single "Stop" button. `SettingsPanel` has checkbox toggle.
- `startTimer` auto-dismisses any active completion notice (UAT 6 fix).

### Settings (Implemented — PR 6.1)
- **SettingsPanel** (`src/components/SettingsPanel.tsx`): shadcn/ui Sheet (slide-out panel) triggered by a gear icon in the top-right corner.
- Settings form with number inputs: work duration (1-60 min), short break (1-30 min), long break (5-60 min), long break frequency (1-10 pomodoros).
- Preset buttons: "25 / 5" (classic pomodoro) and "35 / 7" (extended focus).
- On open: loads current values from `user_settings` table via `settingsRepository.getAll()`.
- On save: validates with `clamp()` + integer checks, writes each setting via `settingsRepository.set()`, calls `timerStore.loadSettings()` to sync, closes the sheet.
- Shows "Changes will apply to the next interval" warning when timer is active.
- DB settings keys: `work_duration_minutes`, `short_break_duration_minutes`, `long_break_duration_minutes`, `long_break_frequency` — stored as string values of integers (minutes).
- Timer store `loadSettings()` reads `_minutes` keys and converts to seconds (e.g., `25` → `1500`).

### Alarm Audio (Implemented — PR 10.1)
- **Chime WAV** (`public/sounds/chime.wav`): two-tone bell (880Hz A5 + 1318.5Hz E6 with harmonics), ~0.8s duration, 16-bit mono PCM at 44100Hz. Generated via `scripts/generate-chime.mjs` (Node.js).
- **Web Audio API** (`src/lib/audio.ts`): primary playback path using `HTMLAudioElement`. `playAlarmChime(volume, repetitions=3)` plays chime N times with 1-second gaps. Volume clamped to 0–1.
- **Rust rodio fallback** (`src-tauri/src/audio.rs`): `play_alarm` Tauri command invoked when web audio fails (e.g., autoplay blocked, webview minimized). Uses `rodio` crate with `include_bytes!` to embed WAV at compile time. Playback runs on a spawned `std::thread` to avoid blocking.
- **Timer integration** (`src/stores/timerStore.ts`): alarm plays on every `timer-complete` event (work, break, overtime) if `alarmVolume > 0`. Errors are silently caught (non-critical).
- **Settings UI** (`src/components/SettingsPanel.tsx`): volume slider (0–100%, step 5%) with percentage display, "Test" button to preview chime at current volume.
- **DB setting**: `alarm_volume` key in `user_settings` (type `real`, default `0.6`). Seeded by migration V3.
- **Migration V3** (`src-tauri/src/database.rs`): `INSERT OR IGNORE` for `alarm_volume` setting with value `0.6`.
- **Fallback strategy**: `playAlarmChime` tries web audio first → catches any error → falls back to `invoke("play_alarm")` (Rust rodio).

### Task History & Cross-Day Copy (Implemented — PR 8.1)
- **Copy to Today**: past-day tasks can be copied to today via "Copy to Today" button in the actions menu. Uses `copy_task_to_day` Rust command which deep-copies the task and subtasks with `linked_from_task_id` set to the original task ID.
- **Copied from indicator**: tasks copied from another day show a "Copied from [date]" clickable link that navigates to the original day. Uses `get_task_origin_dates` Rust command (INNER JOIN on `linked_from_task_id`).
- **Calendar dot indicators**: the calendar popover in DateNavigator shows small dots on days that have tasks. Uses `get_days_with_tasks` Rust command with month-scoped date range. Dots load on popover open and on month change.
- **Task store** (`taskStore.ts`) additions: `daysWithTasks: string[]`, `originDates: Record<number, string>`, `copyTaskToDay()`, `loadDaysWithTasks()`. `loadTasks()` now fetches origin dates alongside tasks and interval counts (3 parallel invokes).
- **CalendarDayButton** (`calendar.tsx`): renders an absolute-positioned dot when `modifiers.hasTask` is truthy. Dot color inverts on selected days.

### Reporting (Implemented — PR 9.1, PR 9.2)
- **Rust commands** in `src-tauri/src/reports.rs`: `get_daily_summary(day_date)`, `get_weekly_summary(week_start)`, and `get_monthly_summary(month_start)`.
- Daily summary: pomodoro count (completed work intervals), total focus minutes, tasks completed/total (excluding subtasks), ordered interval list, task groups by `jira_key` (NULLS LAST).
- Weekly summary: 7-day stats (Mon–Sun) with per-day pomodoro count, focus minutes, tasks completed. Aggregate totals. Task groups across the full week.
- Monthly summary: per-week stats with pomodoro count, focus minutes, tasks completed. Weeks computed from Monday on or before month start, clamped to month boundaries. Aggregate totals.
- Range helpers: `query_range_pomodoro_stats(conn, start, end)` and `query_range_tasks_completed(conn, start, end)` — generalized BETWEEN-based queries used by monthly summary.
- SQL patterns: `date(start_time) = ?1` for day filtering, `BETWEEN ?1 AND ?2` for week/month ranges, `date(?1, '+N day')` for date arithmetic, `strftime('%w', ?1)` for weekday calculation.
- **Zustand store** (`src/stores/reportStore.ts`): manages `activeTab` ("daily"/"weekly"/"monthly"), date navigation state (`dailyDate`, `weekStart`, `monthStart`), loading flags, and summary data. Lazy-loads data on tab switch. Helper functions: `todayStr()`, `getMonday()`, `addDays()`, `getMonthStart()`, `addMonths()`.
- **ReportsPage** (`src/components/ReportsPage.tsx`): shadcn/ui Tabs with Daily/Weekly/Monthly tabs. Connected to `reportStore.activeTab`.
- **DailySummary** (`src/components/DailySummary.tsx`): date navigation (prev/next/Today), stat cards (pomodoros, focus time, tasks ratio), daily timeline chart, interval list with type labels and color coding, task groups by Jira key with status indicators.
- **DailyTimeline** (`src/components/DailyTimeline.tsx`): horizontal bar chart (`indexAxis: "y"`) with Chart.js `TimeScale` x-axis. Uses `chartjs-adapter-date-fns` for time axis. 3 datasets: work (primary), short break (emerald), long break (blue). Floating bars via `[startMs, endMs]` data format. X-axis auto-ranged from 8AM–10PM minimum. Tooltip shows interval type, time range, and duration.
- **WeeklySummary** (`src/components/WeeklySummary.tsx`): week navigation (prev/next/This Week), stat cards, Chart.js `<Bar>` chart (pomodoros per day), daily breakdown rows, task groups. Registers `CategoryScale`, `LinearScale`, `BarElement`, `Tooltip`, `Legend` at module level.
- **MonthlySummary** (`src/components/MonthlySummary.tsx`): month navigation (prev/next/This Month), stat cards (total pomodoros, focus time, tasks done), Chart.js `<Bar>` chart (pomodoros per week), weekly breakdown rows with stats, loading/empty states.
- **App navigation** (`src/App.tsx`): Timer/Reports view toggle buttons (lucide-react `Timer` and `BarChart3` icons). Conditional rendering of Timer+TaskList vs ReportsPage.

### Database
- SQLite with 4 tables: `user_settings`, `timer_intervals`, `tasks`, `task_interval_links`.
- Schema managed via `PRAGMA user_version` (currently v3). Migration runner in `src-tauri/src/database.rs`. V2 adds `completed_in_pomodoro` column to tasks and `break_overtime_enabled` setting. V3 seeds `alarm_volume` default setting (0.6).
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
- Default settings seeded on first run: work=25min, short break=5min, long break=15min, frequency=4, Jira disabled, break overtime disabled, alarm volume=0.6.

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

## Development Plan (12 Milestones)

1. **M1: Scaffolding** — Tauri + React + tooling setup, CI pipeline
2. **M2: Database** — SQLite schema, migrations, TypeScript repository layer
3. **M3: Timer** — Rust state machine + frontend timer UI
4. **M4: Tasks** — CRUD, subtasks, drag-and-drop, day scoping
5. **M5: Timer-Task Link** — Post-interval task association dialog
6. **M6: Settings** — Configurable durations, presets, persistence
7. **M7: Jira** — Credential storage, ticket validation, task linking
8. **M8: Task History** — Past day review, copy tasks forward
9. **M9: Reporting** — Daily/weekly/monthly summaries, visual timeline
10. **M10: Audio & MCP** — Alarm sounds, MCP documentation
11. **M11: UI Overhaul** — Comprehensive UI redesign, mockups then implementation
12. **M12: Installer & Release** — NSIS installer, release config

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
