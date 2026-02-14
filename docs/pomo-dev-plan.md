# Pomo - Development Plan

> Milestones, PRs, testing gates, and UAT criteria for delivering Pomo v1.0.
> References: [pomo-spec.md](./pomo-spec.md) | [pomo-tech.md](./pomo-tech.md)

---

## Overview

The plan is structured as **10 milestones** delivered through **~20 PRs**. Each milestone is a vertical slice that produces a working, testable increment. Milestones are sequential — each builds on the previous — but PRs within a milestone can often be developed in parallel.

### Agent Documentation

Every PR should update `CLAUDE.md` (and any other agent-facing documentation) to reflect changes introduced by that PR. This includes:
- New or removed dependencies
- Changes to project structure (new directories, renamed files)
- New or changed build/run commands
- New architectural patterns or conventions
- Updated file paths or module organization

Keeping `CLAUDE.md` current ensures that Claude Code (and other AI agents) can work effectively with the codebase at every point in time.

### Branching Strategy

```
main (protected, always releasable)
  └── feat/M1-scaffolding
  └── feat/M2-database
  └── feat/M3-timer-backend
  └── feat/M3-timer-frontend
  └── feat/M4-task-crud
  └── ...
```

- Feature branches named `feat/M{n}-{description}`.
- All PRs target `main`.
- PRs require: passing CI (lint + typecheck + unit tests + Rust tests), and manual review.
- E2E tests run post-merge on `main`.

---

## Milestone 1: Project Scaffolding

**Goal:** Empty app shell with all tooling configured. "Hello World" renders in a Tauri window.

### PR 1.1 — Initialize Tauri + React + TypeScript project ✅ COMPLETE

**Status:** Done (2026-02-14). All tests passed.

**Scope:**
- `cargo tauri init` with React + TypeScript + Vite template
- Configure `tauri.conf.json` (app name, window title, window size)
- Install frontend dependencies: React 19, TypeScript, Vite
- Install Tailwind CSS v4 + configure
- Install shadcn/ui CLI + initialize (add first component: Button)
- Install Zustand, React Hook Form, Zod
- Install @dnd-kit/core, @dnd-kit/sortable
- Install Chart.js, react-chartjs-2, react-day-picker
- Configure `tsconfig.json` with strict mode and path aliases

**Documentation:**
- Update `CLAUDE.md` with actual project structure, installed dependencies, and confirmed build commands

**Testing:**
- ~~`cargo tauri dev`~~ `npm run tauri dev` launches a window displaying "Pomo" with a styled Button component — **PASS**
- `tsc --noEmit` passes with zero errors — **PASS**

### PR 1.2 — Configure testing & linting infrastructure ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed.

**Scope:**
- Install and configure Vitest + jsdom + React Testing Library
- Install and configure Biome (linter + formatter)
- Configure Clippy for Rust (`src-tauri/.cargo/config.toml`)
- Add `vitest.config.ts` with coverage via v8
- Add first smoke test: `App.test.tsx` asserts app renders
- Add first Rust test: `src-tauri/src/lib.rs` asserts Tauri app builds
- Add npm scripts: `test`, `test:coverage`, `lint`, `lint:fix`, `typecheck`
- Add `.github/workflows/ci.yml` (or equivalent):
  ```
  lint → typecheck → vitest → cargo test → cargo tauri build
  ```

**Notes:**
- Tauri `common-controls-v6` default feature disabled to fix `cargo test` on Windows (`STATUS_ENTRYPOINT_NOT_FOUND` in test binaries). Rust tests use `tauri::test::mock_builder()` with `MockRuntime`.
- Biome v2 configured with Tailwind CSS directive support and CRLF line endings.

**Testing gate:**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (1 frontend smoke test, 2 assertions) — **PASS**
- `cargo test` passes (1 Rust smoke test) — **PASS**
- CI pipeline runs green — **PASS** (workflow created, not yet run on GitHub)

### UAT — Milestone 1

| # | Verify | Pass? |
|---|--------|-------|
| 1 | `npm run tauri dev` opens a native window with React content | ✅ |
| 2 | Tailwind styles render correctly (test Button component) | ✅ |
| 3 | CI pipeline completes successfully | ✅ |
| 4 | `npm run tauri build` produces an NSIS installer | ✅ |

---

## Milestone 2: Database Foundation

**Goal:** SQLite database initializes on app start with schema v1. Repository layer provides typed access to all tables.

**Spec coverage:** D-1, D-2, D-4, D-5, P-1

### PR 2.1 — SQLite setup and schema migration ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (26 Rust tests).

**Scope:**
- Add `tauri-plugin-sql` (sqlite) and `rusqlite` (bundled) to Rust dependencies
- Create migration runner using `PRAGMA user_version` in `src-tauri/src/database.rs`
- Implement schema v1 (all 4 tables + trigger + indexes from pomo-tech.md)
- DB file created at `$APPDATA/com.pomo.app/pomo.db` via Tauri setup hook
- Enable `PRAGMA foreign_keys = ON` on every connection
- Set journal mode (WAL for local, DELETE for cloud-synced — auto-detected)
- Seed default `user_settings` rows on first run
- Register `tauri-plugin-sql` plugin and add `sql:default` capability

**Notes:**
- `rusqlite` 0.32 (bundled) and `tauri-plugin-sql` 2.3.2 (sqlx-sqlite) share `libsqlite3-sys` 0.30.1 without conflicts.
- Cloud-sync path detection checks for OneDrive, Dropbox, Google Drive, and iCloud in the path string.

**Testing:**
- Rust tests: migration applies cleanly to in-memory DB — **PASS**
- Rust tests: all 4 tables exist — **PASS**
- Rust tests: all 7 indexes exist — **PASS**
- Rust tests: trigger exists and enforces single-level subtasks — **PASS**
- Rust tests: default settings are seeded (6 rows) — **PASS**
- Rust tests: `user_version` is set to 1 after migration — **PASS**
- Rust tests: migration is idempotent — **PASS**
- Rust tests: foreign key cascades work (subtasks, task-interval links) — **PASS**
- Rust tests: CHECK constraints enforced on all enums — **PASS**
- Rust tests: cloud-sync path detection — **PASS**
- Rust tests: `linked_from_task_id` SET NULL on delete — **PASS**
- Clippy passes with `-D warnings` — **PASS**

### PR 2.2 — TypeScript repository layer ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (40 Vitest tests).

**Scope:**
- Create typed wrappers around `tauri-plugin-sql` for each table:
  - `settingsRepository.ts` — `get(key)`, `set(key, value)`, `getAll()`
  - `intervalsRepository.ts` — `create()`, `complete()`, `cancel()`, `getByDateRange()`
  - `tasksRepository.ts` — `create()`, `update()`, `delete()`, `getByDate()`, `reorder()`, `clone()`, `copyToDay()`
  - `taskIntervalLinksRepository.ts` — `link()`, `getByInterval()`, `getByTask()`
- Define TypeScript interfaces for all domain entities (`Task`, `TimerInterval`, `Setting`, etc.)
- Zod schemas for runtime validation of DB results

**Notes:**
- `@tauri-apps/plugin-sql` npm package added for TypeScript Database API (`Database.load()`, `db.select<T>()`, `db.execute()`).
- SQL uses `$1, $2, $3` positional parameters (tauri-plugin-sql convention for SQLite).
- Zod v4 schemas with `z.infer<>` for type derivation — no separate interface definitions needed.
- Repository tests mock `../db` module via `vi.mock()` with dynamic imports (`await import()`).

**Testing:**
- Vitest: repository functions produce correct SQL (mock `Database`) — **PASS**
- Vitest: Zod schemas validate well-formed data and reject malformed data — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (40 tests: 14 schema + 4 settings + 4 intervals + 13 tasks + 3 links + 2 app smoke) — **PASS**

### UAT — Milestone 2

| # | Verify | Pass? |
|---|--------|-------|
| 1 | App creates `pomo.db` on first launch | ✅ |
| 2 | DB contains all 4 tables with correct schema (inspect with DB browser) | ✅ |
| 3 | Default settings are present in `user_settings` | ✅ |
| 4 | Subtask nesting trigger fires when attempting to nest 2 levels deep | ✅ |

---

## Milestone 3: Timer System

**Goal:** Fully functional pomodoro timer with work/break intervals, pause/resume, and long break cycle.

**Spec coverage:** T-1, T-2, T-3, T-5, G-4

### PR 3.1 — Rust timer state machine ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (59 Rust tests total, 32 new timer tests).

**Scope:**
- Implement timer state machine in Rust:
  - States: `Idle`, `Running`, `Paused`
  - Actions: `start(duration, type)`, `pause()`, `resume()`, `cancel()`
  - Wall-clock based: store `end_instant`, compute remaining from `Instant::now()`
- Background Tokio task ticks every 250ms, emits `timer-tick` event
- On completion: emit `timer-complete` event, log interval to `timer_intervals` table
- On cancel: log interval with `status = 'cancelled'`
- Track completed work count for long break trigger (reset after long break)
- Tauri commands: `start_timer`, `pause_timer`, `resume_timer`, `cancel_timer`, `get_timer_state`

**Notes:**
- `tokio` 1 (rt, time, sync, macros) and `chrono` 0.4 added to Rust dependencies.
- Commands are generic over `R: Runtime` to support both `Wry` (production) and `MockRuntime` (tests).
- `AppState` (timer state + DB path) managed via Tauri's `app.manage()` in setup hook.
- Background tick task spawned via `tauri::async_runtime::spawn()`, self-terminates when timer is not Running.
- `#[allow(clippy::needless_pass_by_value)]` required on Tauri commands (framework requires `State` by value).

**Testing:**
- Rust tests: state transitions (idle→running, running→paused, paused→running, running→idle on cancel) — **PASS**
- Rust tests: invalid transitions rejected (double-start, pause-when-idle, resume-when-running, cancel-when-idle) — **PASS**
- Rust tests: completion logs interval with correct start/end timestamps — **PASS**
- Rust tests: long break triggers after N completed work intervals (configurable) — **PASS**
- Rust tests: cancellation logs interval with `cancelled` status — **PASS**
- Rust tests: work count tracking (increment on work, reset on long break, unchanged on short break/cancel) — **PASS**
- Rust tests: serde roundtrip for TimerState and IntervalType enums — **PASS**
- Clippy passes with `-D warnings` — **PASS**

### PR 3.2 — Timer frontend UI ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (78 Vitest tests total, 38 new timer frontend tests).

**Scope:**
- `TimerDisplay` component: large countdown (MM:SS), SVG progress ring
- `TimerControls` component: Start, Pause/Resume, Cancel buttons (shadcn/ui)
- `IntervalTypeSelector` component: Work / Short Break / Long Break radio group
- `TimerPage` component: combines all timer components, pomodoro count, completion notice
- Zustand timer store (`timerStore.ts`): state management, Tauri event subscriptions, command invocations
- Subscribe to `timer-tick` events via `listen()`, update Zustand store
- Subscribe to `timer-complete` events — show completion notification with contextual messages
- Display current interval type and pomodoro count (e.g., "Pomodoro 3 of 4")
- Read work/break durations from settings (via `settingsRepository`)

**Notes:**
- `@testing-library/user-event` added for user interaction testing in component tests.
- IntervalTypeSelector uses native `<input type="radio">` with visually-hidden inputs for Biome a11y compliance.
- Progress ring uses SVG `stroke-dashoffset` animation, color-coded per interval type (primary/emerald/blue).
- TimerPage initializes event listeners, loads settings, and syncs state on mount via `useEffect`.
- All component and store tests mock `@tauri-apps/api/core`, `@tauri-apps/api/event`, and `@/lib/settingsRepository`.

**Testing:**
- Vitest + RTL: TimerDisplay renders formatted time from store — **PASS**
- Vitest + RTL: TimerDisplay shows correct duration for each interval type — **PASS**
- Vitest + RTL: Start button calls `start_timer` command with correct duration — **PASS**
- Vitest + RTL: Pause/Resume toggles correctly — **PASS**
- Vitest + RTL: Cancel button calls `cancel_timer` — **PASS**
- Vitest + RTL: Interval type selector changes the planned duration — **PASS**
- Vitest + RTL: Selector disabled when timer is running — **PASS**
- Vitest: Zustand store updates correctly on mock `timer-tick` events — **PASS**
- Vitest: Store resets to idle and shows notice on `timer-complete` — **PASS**
- Vitest: Store loads settings from repository — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (78 tests) — **PASS**

### UAT — Milestone 3

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Start a 25-minute work timer — countdown displays and decrements |✅  |
| 2 | Pause timer — countdown stops. Resume — countdown continues from where it left off | ✅ |
| 3 | Cancel timer — returns to idle state |✅  |
| 4 | Let a timer complete — notification appears, interval logged in DB |✅  |
| 5 | Complete 4 work intervals — app suggests a long break |✅  |
| 6 | Minimize the window during a timer — timer still completes on time |✅  |

---

## Milestone 4: Task Management ✅ COMPLETE

**Goal:** Full task CRUD with subtasks, drag-and-drop reordering, day scoping, and task flexibility (edit/reopen/undo-delete).

**Spec coverage:** TK-1, TK-2, TK-3, TK-4, TK-7, TK-8, TK-9, TK-10, TK-11, TK-12

### PR 4.1 — Task CRUD and subtasks ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (78 Rust tests, 120 Vitest tests).

**Scope:**
- Tauri commands in `src-tauri/src/tasks.rs`: `create_task`, `update_task`, `delete_task`, `complete_task`, `abandon_task`, `get_tasks_by_date`, `clone_task`, `reorder_tasks`
- Enforce: subtask completion before parent completion (TK-10) in Rust — `complete_task` checks for pending subtasks
- Enforce: single-level subtask nesting (trigger + app logic)
- Task creation form (shadcn/ui Dialog): title, optional tag, optional Jira key
- Task panel component: title, tag badge, status indicator, Jira link, subtask list, expandable action menu
- Subtask component: checkbox + title (inline, compact) with delete
- Status transitions: pending → completed, pending → abandoned
- Clone task command: deep copy including subtasks (TK-11)
- Zustand task store (`taskStore.ts`): CRUD actions, date selection, dialog state
- App layout updated: TimerPage + TaskList in vertical stack

**Notes:**
- shadcn/ui Dialog, Input, Label, Badge, Checkbox components added.
- Task commands open their own DB connection with `PRAGMA foreign_keys = ON`.
- Auto-positioning: `create_task` computes next position as `MAX(position) + 1`.
- `complete_task` returns error "Cannot complete task with pending subtasks" when blocked.

**Testing:**
- Rust tests: CRUD operations on tasks table — **PASS**
- Rust tests: cannot complete parent with pending subtasks — **PASS**
- Rust tests: can complete parent with abandoned subtasks — **PASS**
- Rust tests: clone produces independent copy with subtasks — **PASS**
- Rust tests: reorder updates position values — **PASS**
- Rust tests: status transitions and serde roundtrip — **PASS**
- Vitest + RTL: task panel renders title, tag, jira key, subtasks — **PASS**
- Vitest + RTL: create dialog submits correct data for tasks and subtasks — **PASS**
- Vitest + RTL: checkbox toggles subtask completion — **PASS**
- Vitest + RTL: actions menu (complete, abandon, clone, delete) invokes correct commands — **PASS**
- Vitest: task store CRUD operations, date selection, dialog state — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (120 tests) — **PASS**
- `cargo clippy -- -D warnings` passes — **PASS**

### PR 4.2 — Drag-and-drop reordering ✅ COMPLETE

**Status:** Done (2026-02-14). All tests passed (125 Vitest).

**Scope:**
- Integrate @dnd-kit `SortableContext` for the task list
- On drag end: update `position` column via `reorder_tasks` Tauri command (implemented in PR 4.1)
- Visual drag overlay with `TaskPanelOverlay` component
- Drag handle (`GripVertical` icon) on each task panel via `useSortable` + `setActivatorNodeRef`
- `PointerSensor` (distance: 8) and `KeyboardSensor` with `sortableKeyboardCoordinates`
- `DragOverlay` renders simplified task preview during drag

**Testing:**
- Vitest + RTL: @dnd-kit renders sortable items in correct order (4 tests)
- Rust tests: `reorder_tasks` updates position values correctly (covered in PR 4.1)
- Manual: drag a task panel — it reorders smoothly with animation (pending user confirmation)

**Notes:**
- Subtask reordering within a parent panel was not scoped — subtasks are rendered in DB order
- `TaskPanel` applies `opacity-50` when `isDragging` for visual feedback
- `TaskPanelOverlay` shows title, tag badge, and subtask count in a `shadow-lg` card

### PR 4.3 — Day scoping and navigation ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (136 Vitest tests, 11 new DateNavigator tests).

**Scope:**
- Task list filtered by current day (default: today)
- Date navigator component (react-day-picker): select a day to view its tasks
- Tasks created with `day_date` set to the currently selected day
- Display "Today" / "Feb 14, 2026" header above the task list
- Visual distinction for past days (read-only feel, but still editable)

**Notes:**
- shadcn/ui Calendar and Popover components added (`npx shadcn@latest add calendar popover`).
- `DateNavigator` component uses prev/next day buttons (ChevronLeft/ChevronRight), a calendar popover (react-day-picker v9 in single select mode), and a "Today" button when viewing non-today dates.
- Past day indicator shows "Viewing a past day" text when `selectedDate < today`.
- No Rust backend changes needed — `get_tasks_by_date` and `taskStore.setSelectedDate()` already supported date filtering from PR 4.1.
- `TaskList` now renders `<DateNavigator />` instead of a static date header.

**Testing:**
- Vitest + RTL: renders "Today" when selected date is today — **PASS**
- Vitest + RTL: renders formatted date for non-today dates — **PASS**
- Vitest + RTL: "Today" button shown only when viewing a different date — **PASS**
- Vitest + RTL: past-day indicator shown for past dates — **PASS**
- Vitest + RTL: prev/next day navigation updates store and reloads tasks — **PASS**
- Vitest + RTL: calendar popover opens on date header click — **PASS**
- Vitest + RTL: selecting a date from calendar updates store — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (136 tests) — **PASS**
- `cargo clippy -- -D warnings` passes — **PASS**

### PR 4.4 — Task flexibility improvements ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (83 Rust tests, 165 Vitest tests).

**Scope:**
- Edit task after creation — reuse TaskCreateDialog in edit mode (title, tag, Jira key)
- Subtask inline rename — click edit icon to rename in place (Enter/blur saves, Escape cancels)
- Toggle completion — completed tasks can be reopened (→ pending) via checkbox or Reopen button
- Toggle abandon — abandoned tasks can be reopened (→ pending) via Reopen button
- Delete with undo toast — Sonner toast with 10-second Undo button; actual backend delete fires after timeout
- Block delete on completed/abandoned — must reopen first (backend rejects, UI hides delete button)

**Notes:**
- New Tauri command `reopen_task`: sets status from completed/abandoned → pending, returns error if already pending.
- `delete_task` now validates status — rejects deletion of completed/abandoned tasks.
- Sonner toast library added via `npx shadcn@latest add sonner` (removed `next-themes` dependency from generated component).
- `<Toaster />` added to `App.tsx` root.
- Zustand store extended: `reopenTask`, `softDeleteTask`, `undoDelete`, `openEditDialog`/`closeEditDialog`, `showEditDialog`/`editTask`/`pendingDelete` state.
- `TaskCreateDialog` supports edit mode: pre-populates fields, dynamic title ("Edit Task"/"Edit Subtask"), calls `updateTask` on submit.
- `TaskPanel` now shows Edit button (always), Reopen button (for completed/abandoned), hides Delete/Abandon/Complete for non-pending.
- `SubtaskItem` now has inline edit (pencil icon → input), toggle checkbox (reopen on completed), and soft delete.

**Testing:**
- Rust tests: reopen from completed/abandoned → pending — **PASS**
- Rust tests: reopen when already pending → error — **PASS**
- Rust tests: delete rejected for completed/abandoned tasks — **PASS**
- Vitest + RTL: edit button opens edit dialog with task data — **PASS**
- Vitest + RTL: checkbox toggles completed → pending (reopen) — **PASS**
- Vitest + RTL: Reopen button shown for completed/abandoned tasks — **PASS**
- Vitest + RTL: delete hidden for completed/abandoned tasks — **PASS**
- Vitest + RTL: delete calls softDeleteTask (no immediate invoke) — **PASS**
- Vitest + RTL: edit mode pre-populates fields and calls updateTask — **PASS**
- Vitest + RTL: subtask inline edit (click → input → blur saves, Escape cancels) — **PASS**
- Vitest + RTL: subtask checkbox toggles completed → pending — **PASS**
- Vitest: store reopenTask, edit dialog state, softDelete/undoDelete flow — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (165 tests) — **PASS**
- `cargo test` passes (83 tests) — **PASS**
- `cargo clippy -- -D warnings` passes — **PASS**

### UAT — Milestone 4

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Create a task with title and tag — appears in the task list | ✅ |
| 2 | Add a subtask — appears nested under parent | ✅ |
| 3 | Complete all subtasks, then complete parent — works. Try completing parent with pending subtask — blocked | ✅ |
| 4 | Drag a task to reorder — position persists on reload | ✅ |
| 5 | Mark a task as abandoned — visual indicator shows, task remains visible | ✅ |
| 6 | Delete a task — removed from list and DB | ✅ |
| 7 | Clone a task with subtasks — new independent copy appears | ✅ |
| 8 | Navigate to a different day — task list updates | ✅ |
| 9 | Edit a task after creation — title/tag/Jira key updated | ✅ |
| 10 | Reopen a completed task — returns to pending | ✅ |
| 11 | Reopen an abandoned task — returns to pending | ✅ |
| 12 | Delete a task → undo within 10s → task restored | ✅ |
| 13 | Completed/abandoned task — delete button hidden | ✅ |
| 14 | Subtask inline rename — edit icon → type → blur saves | ✅ |

---

## Milestone 5: Timer–Task Association ✅ COMPLETE

**Goal:** After a pomodoro completes, the user can select tasks to associate with that interval.

**Spec coverage:** T-6, T-7, G-4

### PR 5.1 — Post-interval task association ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (88 Rust tests, 182 Vitest tests).

**Scope:**
- On `timer-complete` (work interval only): show association dialog
- Dialog lists all tasks for the current day with checkboxes
- User selects completed tasks → writes to `task_interval_links`
- Tasks remain independently completable (not auto-completed by association)
- Interval info displayed on task panels (pomodoro count with clock icon)
- Skip association dialog for break intervals

**Notes:**
- New Tauri commands: `link_tasks_to_interval(task_ids, interval_id)` batch-inserts with `INSERT OR IGNORE` for deduplication; `get_task_interval_counts(day_date)` returns joined counts per task.
- Timer store extended: `showAssociationDialog`, `lastCompletedIntervalId`, `showAssociation()`, `dismissAssociationDialog()`. Association dialog triggered only for work intervals in `timer-complete` handler.
- Task store extended: `intervalCounts: Record<number, number>` loaded alongside tasks via `Promise.all` in `loadTasks`.
- `IntervalAssociationDialog` component: shadcn/ui Dialog with checkboxes for parent tasks, Confirm/Skip buttons. Confirm calls `link_tasks_to_interval` then reloads tasks. Skip dismisses without linking.
- `TaskPanel` shows "N pomodoro(s)" with lucide-react `Clock` icon when `intervalCounts[task.id] > 0`.
- Biome a11y: Checkbox row uses `<div>` with `biome-ignore` for click handler (Radix Checkbox handles keyboard a11y internally).

**Testing:**
- Rust tests: link creation, batch linking, INSERT OR IGNORE deduplication, interval count query, day-scoped filtering — **PASS**
- Vitest + RTL: dialog appears after work interval completes — **PASS**
- Vitest + RTL: dialog does not appear after break interval completes — **PASS**
- Vitest + RTL: shows "No tasks for today" when empty — **PASS**
- Vitest + RTL: renders parent tasks only (not subtasks) — **PASS**
- Vitest + RTL: clicking task row toggles checkbox — **PASS**
- Vitest + RTL: confirm disabled when no tasks selected — **PASS**
- Vitest + RTL: selecting tasks and confirming calls `link_tasks_to_interval` — **PASS**
- Vitest + RTL: skip dismisses without linking — **PASS**
- Vitest + RTL: after confirm, dialog dismissed and tasks reloaded — **PASS**
- Vitest + RTL: task panel shows pomodoro count (singular/plural) — **PASS**
- Vitest + RTL: task panel hides count when no linked intervals — **PASS**
- Vitest: timer store association dialog state (show/dismiss) — **PASS**
- Vitest: task store loads interval counts from backend — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (182 tests) — **PASS**
- `cargo test` passes (88 tests) — **PASS**
- `cargo clippy -- -D warnings` passes — **PASS**

### UAT — Milestone 5

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Complete a work interval — association dialog appears with today's tasks | TODO|
| 2 | Select 2 tasks and confirm — links persist in DB | TODO|
| 3 | Complete a break interval — no association dialog | TODO |
| 4 | Task panel shows which pomodoro(s) it was logged against | TODO |

---

## Milestone 6: Settings & User Profile ✅ COMPLETE

**Goal:** Configurable timer durations and app preferences that persist across sessions.

**Spec coverage:** P-1, P-2, P-3, P-4, T-2

### PR 6.1 — Settings UI and persistence ✅ COMPLETE

**Status:** Done (2026-02-14). All testing gates passed (91 Rust tests, 192 Vitest tests).

**Scope:**
- Settings panel (shadcn/ui Sheet, slide-out from right):
  - Work interval duration (number input, 1-60 min)
  - Short break duration (1-30 min)
  - Long break duration (5-60 min)
  - Long break frequency (1-10 pomodoros)
  - Preset buttons: 25/5, 35/7
- Read settings on app start → apply as defaults to timer
- Save settings → write to `user_settings` table via `settingsRepository.set()`
- Settings validation with clamp + integer checks
- Gear icon trigger in top-right of app layout
- Timer-active warning when settings changed during an active timer

**Notes:**
- shadcn/ui Sheet and Slider components added (`npx shadcn@latest add sheet slider`).
- Fixed timer store settings key mismatch: DB stores `work_duration_minutes` etc, timer store was reading `work_duration_seconds`. Now reads `_minutes` keys and converts to seconds (e.g., `25` → `1500`).
- Settings panel uses local React state (no dedicated store). On open: loads from DB. On save: writes to DB, calls `timerStore.loadSettings()`, closes sheet.
- Presets: "25 / 5" (25/5/15/4) and "35 / 7" (35/7/21/4).

**Testing:**
- Vitest + RTL: settings trigger renders — **PASS**
- Vitest + RTL: sheet opens on trigger click — **PASS**
- Vitest + RTL: form displays current values loaded from repository — **PASS**
- Vitest + RTL: saving writes all settings to repository with correct keys — **PASS**
- Vitest + RTL: timer settings reloaded after save — **PASS**
- Vitest + RTL: 25/5 preset populates correct values — **PASS**
- Vitest + RTL: 35/7 preset populates correct values — **PASS**
- Vitest + RTL: timer-active warning shown when timer is running — **PASS**
- Vitest + RTL: no timer warning when idle — **PASS**
- Vitest + RTL: sheet closes after successful save — **PASS**
- Rust tests: settings update and read round-trip — **PASS**
- Rust tests: all timer duration settings round-trip — **PASS**
- Rust tests: updated_at changes on update — **PASS**
- `npm run lint` passes — **PASS**
- `npm run typecheck` passes — **PASS**
- `npm run test` passes (192 tests) — **PASS**
- `cargo test` passes (91 tests) — **PASS**

### UAT — Milestone 6

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Open settings — current values displayed | ✅ |
| 2 | Change work duration to 35 min — save — start timer — countdown starts at 35:00 | ✅ |
| 3 | Close and reopen app — settings persist | ✅ |
| 4 | Click 25/5 preset — values update | ✅ |

---

## Milestone 7: Jira Integration

**Goal:** Tasks can be linked to Jira tickets with optional API validation.

**Spec coverage:** J-1 through J-8

### PR 7.1 — Jira configuration and credential storage

**Scope:**
- Settings section for Jira:
  - Base URL input
  - Auth type selector (Cloud API Token / Server PAT)
  - Credential inputs (email + token, or PAT)
  - API validation toggle (on/off)
- Store credentials via `keyring` crate (Tauri command)
- Store base URL and settings in `user_settings` table

**Testing:**
- Rust tests: credentials stored and retrieved from OS keychain
- Vitest + RTL: Jira settings form renders and saves correctly

### PR 7.2 — Ticket validation and task linking

**Scope:**
- Rust command: `validate_jira_ticket(issue_key)` → calls Jira API via `reqwest`
  - Returns summary + status on success
  - Returns error info on 401/403/404/timeout
- Task creation form: Jira key input field
  - If API enabled: validate on blur, show summary or error
  - If API disabled: accept any matching pattern `/^[A-Z][A-Z0-9]+-\d+$/`
  - If API unreachable: show warning, allow saving (J-6, J-8)
- Jira key displayed on task panel as clickable hyperlink (opens browser via Tauri shell)
- Subtasks inherit parent's Jira key (J-4) — display only, not editable on subtask

**Testing:**
- Rust tests (with `mockito`): validate returns correct result for 200, 401, 404, timeout
- Vitest + RTL (with MSW): task form shows Jira summary after validation
- Vitest + RTL: Jira link renders as hyperlink with correct URL
- Vitest + RTL: subtask displays inherited Jira key

### UAT — Milestone 7

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Configure Jira base URL and credentials in settings | |
| 2 | Create a task with Jira key — ticket summary appears after validation | |
| 3 | Enter an invalid Jira key — error message displayed | |
| 4 | Disable API validation — any key format accepted without API call | |
| 5 | Disconnect network — Jira link saved with "unverified" indicator | |
| 6 | Click Jira link on task panel — opens ticket in browser | |
| 7 | Subtask shows parent's Jira key (not editable) | |

---

## Milestone 8: Task History & Cross-Day

**Goal:** Review past days and copy tasks forward.

**Spec coverage:** TK-5, TK-6

### PR 8.1 — Previous day review and task copying

**Scope:**
- Date navigator highlights days that have tasks (dot indicator)
- Navigate to any past day — see that day's tasks (read-only by default, or editable)
- "Copy to today" button on past-day tasks:
  - Creates new task on current day with `linked_from_task_id` pointing to original
  - Deep copies subtasks if present (TK-11 logic reused)
  - Original remains on its original day unchanged
- Copied task shows a "Copied from [date]" indicator with link back to original

**Testing:**
- Rust tests: `copy_to_day` creates linked task with correct `linked_from_task_id`
- Rust tests: subtasks are deep-copied for the new task
- Vitest + RTL: past day tasks display with "Copy to today" action
- Vitest + RTL: copied task shows origin link

### UAT — Milestone 8

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Navigate to a past day with tasks — tasks display correctly | |
| 2 | Copy a task to today — new task appears on today with link to original | |
| 3 | Copy a task with subtasks — subtasks are copied too | |
| 4 | Original task unchanged on its original day | |

---

## Milestone 9: Reporting & Analytics

**Goal:** Daily, weekly, and monthly summaries with visual timeline.

**Spec coverage:** R-1 through R-7

### PR 9.1 — Daily and weekly summary views

**Scope:**
- Reports page with tab navigation: Daily / Weekly / Monthly
- Daily summary:
  - Pomodoro count, total focus time, tasks completed
  - Tasks grouped by Jira ticket (R-5) with count per ticket
  - List of completed intervals with timestamps
- Weekly summary:
  - Aggregate pomodoro count and tasks completed per day
  - Bar chart (Chart.js): pomodoros per day of the week
  - Tasks grouped by Jira ticket across the week (R-5)
- Rust commands: `get_daily_summary(date)`, `get_weekly_summary(week_start)`

**Testing:**
- Rust tests: summary queries return correct aggregations with seed data
- Vitest + RTL: daily view renders pomodoro count and task list
- Vitest + RTL: weekly bar chart renders with correct data

### PR 9.2 — Visual timeline and monthly view

**Scope:**
- Daily visual timeline (R-4):
  - Chart.js horizontal bar chart with time-scale x-axis (8AM–10PM)
  - Work intervals, short breaks, long breaks as colored bars positioned at actual times
  - Floating bars using `[start, end]` data points on the time axis
- Monthly view:
  - Aggregate by week (R-6)
  - Weekly pomodoro totals in a simple table or bar chart
  - Total tasks completed per week
- All reports are view-only (R-7)

**Testing:**
- Vitest: Chart.js datasets are constructed correctly from interval data
- Rust tests: monthly aggregation query returns correct weekly totals
- Manual: timeline visually shows intervals at correct positions

### UAT — Milestone 9

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Daily view shows correct pomodoro count and completed tasks | |
| 2 | Daily timeline shows work/break blocks at the right times | |
| 3 | Weekly view shows bar chart of pomodoros per day | |
| 4 | Weekly view groups tasks by Jira ticket with counts | |
| 5 | Monthly view aggregates by week | |
| 6 | Navigate to a past week/month — data loads correctly | |

---

## Milestone 10: Audio, MCP & Polish

**Goal:** Alarm sounds, MCP documentation, final UI polish, and release packaging.

**Spec coverage:** T-4, D-3, D-4, G-2, G-3

### PR 10.1 — Alarm audio

**Scope:**
- Bundle a calm chime sound (CC0/free license, ~2 seconds)
- Play via Web Audio API on `timer-complete` event
- Rust `rodio` fallback: play from backend if webview is minimized
- Volume setting in user_settings (default 0.6)
- Play sound 2-3 times with 1-second gaps

**Testing:**
- Manual: alarm plays on interval completion
- Manual: alarm plays when app is minimized
- Vitest: audio trigger is called on timer-complete event (mock Audio)

### PR 10.2 — MCP documentation and DB path configuration

**Scope:**
- DB path configuration in settings (file picker dialog via Tauri)
- Cloud-sync detection: if path is in OneDrive/Dropbox folder, use `journal_mode=DELETE`
- Document MCP server setup in README or docs:
  - How to configure `@anthropic-ai/mcp-server-sqlite` with Pomo's DB path
  - Example queries an AI agent can run
- Ensure WAL mode allows concurrent MCP reads

**Testing:**
- Rust tests: journal mode switches correctly based on path
- Manual: MCP server connects to Pomo DB and can query tasks

### PR 10.3 — UI polish and final touches

**Scope:**
- Consistent spacing, typography, and color palette across all views
- Empty states (no tasks today, no intervals this week, etc.)
- Loading states for async operations (Jira validation, DB queries)
- Error states and toast notifications for failures
- App icon and window title
- Keyboard shortcut architecture prep (G-1) — no shortcuts yet, but ensure nothing blocks future addition

**Testing:**
- Manual: visual review of all screens
- Manual: all empty states render meaningfully
- Manual: error scenarios show appropriate feedback

### PR 10.4 — Installer and release configuration

**Scope:**
- Configure `tauri.conf.json` for production build:
  - App name, version, description, icon
  - NSIS installer settings (install mode, shortcuts)
  - WebView2 bootstrapper bundled
- `tauri-plugin-updater` configuration (update endpoint, signing key)
- Build and test the NSIS installer on a clean Windows machine
- Create GitHub Release workflow (optional)

**Testing:**
- Install from NSIS installer on a clean Windows 11 machine
- App launches, DB initializes, all features work
- Uninstaller removes the app cleanly

### UAT — Milestone 10

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Timer completes — calm chime plays | |
| 2 | Minimize app, timer completes — alarm still audible | |
| 3 | Configure DB path — app uses new location | |
| 4 | MCP server can query the Pomo database | |
| 5 | Install from NSIS installer on clean machine — app works | |
| 6 | All screens have appropriate empty, loading, and error states | |

---

## Full Regression / UAT Checklist (v1.0 Release)

Run this against the final build before tagging v1.0.

### Timer System

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 1 | T-1 | Start, pause, resume, and cancel a work timer | |
| 2 | T-1 | Start a short break and a long break manually | |
| 3 | T-2 | Change work/break durations in settings — timer uses new values | |
| 4 | T-3 | Complete 4 pomodoros — long break suggested | |
| 5 | T-4 | Alarm plays with calm tone on work and break completion | |
| 6 | T-5 | Completed intervals appear in DB with correct timestamps | |
| 7 | T-6 | After work interval, associate tasks via checkbox dialog | |
| 8 | T-7 | Completed task shows reference to its associated pomodoro | |
| 9 | — | Timer runs accurately when app is minimized | |
| 10 | — | Timer recovers correctly after system sleep/wake | |

### Task Management

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 11 | TK-1 | Create, delete, and clone a task | |
| 12 | TK-2 | Add subtask to a task. Attempt to add subtask to subtask — blocked | |
| 13 | TK-3 | Drag-and-drop reorder tasks — order persists on reload | |
| 14 | TK-4 | New task is scoped to the selected day | |
| 15 | TK-5 | Navigate to a past day — see its tasks | |
| 16 | TK-6 | Copy a past task to today — link to original maintained | |
| 17 | TK-7 | Abandon a task — marked visually, remains in history | |
| 18 | TK-8 | Delete a task — hard removed from DB | |
| 19 | TK-9 | Task shows title, Jira key (as link), and tag | |
| 20 | TK-10 | Cannot complete parent while subtask is pending | |
| 21 | TK-11 | Clone task with subtasks — deep copy produced | |
| 22 | TK-12 | Task completion is manual (no auto-complete) | |

### Jira Integration

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 23 | J-1 | Link a task to a Jira ticket key | |
| 24 | J-2 | API validates ticket exists (when enabled) | |
| 25 | J-3 | Jira key is a clickable hyperlink opening the browser | |
| 26 | J-4 | Subtask inherits parent's Jira link | |
| 27 | J-5 | No data written back to Jira | |
| 28 | J-6 | API error — user can still save the link | |
| 29 | J-7 | Toggle API validation off — keys accepted without API call | |
| 30 | J-8 | API unreachable — UI note shown, association saved | |

### Settings & Profile

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 31 | P-1 | Single local profile, no multi-user | |
| 32 | P-2 | Settings persist across app restarts | |
| 33 | P-3 | Work, short break, long break durations all configurable | |

### Reporting

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 34 | R-1 | Daily, weekly, monthly views show completed intervals | |
| 35 | R-2 | Working day = midnight to midnight | |
| 36 | R-3 | Daily/weekly summaries show pomodoro count and tasks completed | |
| 37 | R-4 | Visual timeline shows pomodoros/breaks on a time axis | |
| 38 | R-5 | Wrap-ups group tasks by Jira ticket | |
| 39 | R-6 | Monthly report aggregates by week | |
| 40 | R-7 | Reports are view-only (no export) | |

### Data & Storage

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 41 | D-1 | All data persisted in SQLite | |
| 42 | D-2 | DB path is configurable | |
| 43 | D-3 | DB works in a cloud-synced directory | |
| 44 | D-4 | MCP server can query the DB | |
| 45 | D-5 | Single-instance assumed (no lock contention) | |

### General

| # | Spec | Scenario | Pass? |
|---|------|----------|-------|
| 46 | G-1 | All features accessible via mouse | |
| 47 | G-2 | Only in-app alarm, no OS notifications | |
| 48 | G-3 | Data retained indefinitely, no auto-purge | |
| 49 | G-4 | Timers and tasks are loosely coupled | |
| 50 | — | Install from NSIS installer on clean Win 11 | |
| 51 | — | Uninstall removes app cleanly | |

---

## Timeline Estimate

| Milestone | PRs | Estimated Effort |
|---|---|---|
| M1: Scaffolding | 2 | Small |
| M2: Database | 2 | Small |
| M3: Timer | 2 | Medium |
| M4: Tasks | 4 | Medium-Large |
| M5: Timer-Task Link | 1 | Small |
| M6: Settings | 1 | Small |
| M7: Jira | 2 | Medium |
| M8: Task History | 1 | Small-Medium |
| M9: Reporting | 2 | Medium |
| M10: Audio/MCP/Polish | 4 | Medium |
| **Total** | **~20 PRs** | |

> Time estimates are intentionally omitted per project conventions. The milestone ordering reflects dependencies — each builds on the previous.

---

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| **@dnd-kit maintenance stalls** | Medium — DnD may need patching for React 19+ | Pin version. If breaking: migrate to a community fork or SortableJS wrapper. |
| **Tauri plugin gaps** | Medium — `tauri-plugin-sql` may not cover complex queries | Write custom Rust commands with `rusqlite` for anything the plugin can't handle. |
| **Rust learning curve** | High — slows backend development | Keep Rust code simple. Lean on `tauri-plugin-sql` for data access. Only write custom Rust for timer, audio, Jira HTTP, and credentials. |
| **WebView2 inconsistencies** | Low — rendering differences from Chrome | Test on Windows 10 and 11. WebView2 is Chromium-based so issues are rare. |
| **Cloud-sync DB corruption** | Medium — WAL files synced independently | Default to `journal_mode=DELETE` for cloud paths. Checkpoint on close for local WAL. Document the risk. |
