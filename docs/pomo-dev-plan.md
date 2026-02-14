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

### PR 1.2 — Configure testing & linting infrastructure

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

**Testing gate:**
- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test` passes (1 frontend smoke test)
- `cargo test` passes (1 Rust smoke test)
- CI pipeline runs green

### UAT — Milestone 1

| # | Verify | Pass? |
|---|--------|-------|
| 1 | `cargo tauri dev` opens a native window with React content | |
| 2 | Tailwind styles render correctly (test Button component) | |
| 3 | CI pipeline completes successfully | |
| 4 | `cargo tauri build` produces an NSIS installer | |

---

## Milestone 2: Database Foundation

**Goal:** SQLite database initializes on app start with schema v1. Repository layer provides typed access to all tables.

**Spec coverage:** D-1, D-2, D-4, D-5, P-1

### PR 2.1 — SQLite setup and schema migration

**Scope:**
- Add `tauri-plugin-sql` to Rust dependencies
- Create migration runner using `PRAGMA user_version`
- Implement schema v1 (all 4 tables + trigger + indexes from pomo-tech.md)
- DB file created at configurable path (default: `$APPDATA/pomo/pomo.db`)
- Enable `PRAGMA foreign_keys = ON` on every connection
- Set journal mode (WAL for local, DELETE for cloud-synced — detect or configure)
- Seed default `user_settings` rows on first run

**Testing:**
- Rust tests: migration applies cleanly to in-memory DB, all tables exist, indexes exist, trigger works
- Rust tests: default settings are seeded
- Rust tests: `user_version` is set to 1 after migration

### PR 2.2 — TypeScript repository layer

**Scope:**
- Create typed wrappers around `tauri-plugin-sql` for each table:
  - `settingsRepository.ts` — `get(key)`, `set(key, value)`, `getAll()`
  - `intervalsRepository.ts` — `create()`, `complete()`, `cancel()`, `getByDateRange()`
  - `tasksRepository.ts` — `create()`, `update()`, `delete()`, `getByDate()`, `reorder()`, `clone()`, `copyToDay()`
  - `taskIntervalLinksRepository.ts` — `link()`, `getByInterval()`, `getByTask()`
- Define TypeScript interfaces for all domain entities (`Task`, `TimerInterval`, `Setting`, etc.)
- Zod schemas for runtime validation of DB results

**Testing:**
- Vitest: repository functions produce correct SQL (mock `invoke`)
- Vitest: Zod schemas validate well-formed data and reject malformed data

### UAT — Milestone 2

| # | Verify | Pass? |
|---|--------|-------|
| 1 | App creates `pomo.db` on first launch | |
| 2 | DB contains all 4 tables with correct schema (inspect with DB browser) | |
| 3 | Default settings are present in `user_settings` | |
| 4 | Subtask nesting trigger fires when attempting to nest 2 levels deep | |

---

## Milestone 3: Timer System

**Goal:** Fully functional pomodoro timer with work/break intervals, pause/resume, and long break cycle.

**Spec coverage:** T-1, T-2, T-3, T-5, G-4

### PR 3.1 — Rust timer state machine

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

**Testing:**
- Rust tests: state transitions (idle→running, running→paused, paused→running, running→idle on cancel)
- Rust tests: completion logs interval with correct start/end timestamps
- Rust tests: long break triggers after N completed work intervals (configurable)
- Rust tests: cancellation logs interval with `cancelled` status

### PR 3.2 — Timer frontend UI

**Scope:**
- `TimerDisplay` component: large countdown (MM:SS), progress ring/bar
- `TimerControls` component: Start, Pause/Resume, Cancel buttons (shadcn/ui)
- Interval type selector: Work / Short Break / Long Break
- Subscribe to `timer-tick` events via `listen()`, update Zustand store
- Subscribe to `timer-complete` events — show completion notification
- Display current interval type and pomodoro count (e.g., "Pomodoro 3 of 4")
- Read work/break durations from settings (via `settingsRepository`)

**Testing:**
- Vitest + RTL: TimerDisplay renders formatted time from store
- Vitest + RTL: Start button calls `start_timer` command with correct duration
- Vitest + RTL: Pause/Resume toggles correctly
- Vitest + RTL: Interval type selector changes the planned duration
- Vitest: Zustand store updates correctly on mock `timer-tick` events

### UAT — Milestone 3

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Start a 25-minute work timer — countdown displays and decrements | |
| 2 | Pause timer — countdown stops. Resume — countdown continues from where it left off | |
| 3 | Cancel timer — returns to idle state | |
| 4 | Let a timer complete — notification appears, interval logged in DB | |
| 5 | Complete 4 work intervals — app suggests a long break | |
| 6 | Minimize the window during a timer — timer still completes on time | |

---

## Milestone 4: Task Management

**Goal:** Full task CRUD with subtasks, drag-and-drop reordering, and day scoping.

**Spec coverage:** TK-1, TK-2, TK-3, TK-4, TK-7, TK-8, TK-9, TK-10, TK-11, TK-12

### PR 4.1 — Task CRUD and subtasks

**Scope:**
- Tauri commands: `create_task`, `update_task`, `delete_task`, `create_subtask`, `abandon_task`, `complete_task`
- Enforce: subtask completion before parent completion (TK-10) in Rust
- Enforce: single-level subtask nesting (trigger + app logic)
- Task creation form (shadcn/ui Dialog): title, optional tag, optional Jira key
- Task panel component: title, tag badge, status indicator, Jira link, subtask list
- Subtask component: checkbox + title (inline, compact)
- Status transitions: pending → completed, pending → abandoned
- Clone task command: deep copy including subtasks (TK-11)

**Testing:**
- Rust tests: CRUD operations on `tasks` table
- Rust tests: cannot complete parent with pending subtasks
- Rust tests: clone produces independent copy with subtasks
- Vitest + RTL: task panel renders all fields correctly
- Vitest + RTL: create dialog submits correct data
- Vitest + RTL: checkbox toggles subtask completion

### PR 4.2 — Drag-and-drop reordering

**Scope:**
- Integrate @dnd-kit `SortableContext` for the task list
- Nested `SortableContext` for subtasks within each task panel
- On drag end: update `position` column via `reorder_tasks` Tauri command
- Visual drag overlay with task panel preview
- Drag handle on each task panel

**Testing:**
- Vitest + RTL: @dnd-kit renders sortable items in correct order
- Rust tests: `reorder_tasks` updates position values correctly
- Manual: drag a task panel — it reorders smoothly with animation

### PR 4.3 — Day scoping and navigation

**Scope:**
- Task list filtered by current day (default: today)
- Date navigator component (react-day-picker): select a day to view its tasks
- Tasks created with `day_date` set to the currently selected day
- Display "Today" / "Feb 14, 2026" header above the task list
- Visual distinction for past days (read-only feel, but still editable)

**Testing:**
- Vitest + RTL: task list shows only tasks for selected date
- Vitest + RTL: date navigator changes the displayed day
- Vitest + RTL: new task gets the currently selected day's date

### UAT — Milestone 4

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Create a task with title and tag — appears in the task list | |
| 2 | Add a subtask — appears nested under parent | |
| 3 | Complete all subtasks, then complete parent — works. Try completing parent with pending subtask — blocked | |
| 4 | Drag a task to reorder — position persists on reload | |
| 5 | Mark a task as abandoned — visual indicator shows, task remains visible | |
| 6 | Delete a task — removed from list and DB | |
| 7 | Clone a task with subtasks — new independent copy appears | |
| 8 | Navigate to a different day — task list updates | |

---

## Milestone 5: Timer–Task Association

**Goal:** After a pomodoro completes, the user can select tasks to associate with that interval.

**Spec coverage:** T-6, T-7, G-4

### PR 5.1 — Post-interval task association

**Scope:**
- On `timer-complete` (work interval only): show association dialog
- Dialog lists all tasks for the current day with checkboxes
- User selects completed tasks → writes to `task_interval_links`
- Tasks remain independently completable (not auto-completed by association)
- Interval info displayed on task panels ("Logged in Pomodoro #3")
- Skip association dialog for break intervals

**Testing:**
- Vitest + RTL: dialog appears after work interval completes
- Vitest + RTL: selecting tasks and confirming calls `link` command
- Rust tests: `task_interval_links` UNIQUE constraint prevents duplicates
- Vitest + RTL: task panel shows associated interval info

### UAT — Milestone 5

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Complete a work interval — association dialog appears with today's tasks | |
| 2 | Select 2 tasks and confirm — links persist in DB | |
| 3 | Complete a break interval — no association dialog | |
| 4 | Task panel shows which pomodoro(s) it was logged against | |

---

## Milestone 6: Settings & User Profile

**Goal:** Configurable timer durations and app preferences that persist across sessions.

**Spec coverage:** P-1, P-2, P-3, P-4, T-2

### PR 6.1 — Settings UI and persistence

**Scope:**
- Settings page/panel (shadcn/ui Tabs or Sheet):
  - Work interval duration (slider or number input, 1-60 min)
  - Short break duration (1-30 min)
  - Long break duration (5-60 min)
  - Long break frequency (1-10 pomodoros)
  - Preset buttons: 25/5, 35/7
- Read settings on app start → apply as defaults to timer
- Save settings → write to `user_settings` table
- Settings validation with Zod

**Testing:**
- Vitest + RTL: settings form renders current values from store
- Vitest + RTL: changing a value and saving calls the correct command
- Rust tests: settings read/write round-trip correctly
- Vitest + RTL: preset buttons populate correct values

### UAT — Milestone 6

| # | Verify | Pass? |
|---|--------|-------|
| 1 | Open settings — current values displayed | |
| 2 | Change work duration to 35 min — save — start timer — countdown starts at 35:00 | |
| 3 | Close and reopen app — settings persist | |
| 4 | Click 25/5 preset — values update | |

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
| M4: Tasks | 3 | Medium-Large |
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
