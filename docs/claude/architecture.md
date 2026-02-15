# Architecture Reference

Detailed architecture notes for each subsystem. Read on-demand when working on a specific area.

## Timer System

- State machine in `src-tauri/src/timer.rs`: `TimerState` (Idle, Running, Paused), `IntervalType` (Work, ShortBreak, LongBreak).
- Runs as a Tokio async task in Rust — never in the frontend (webview throttling breaks timers when minimized).
- Uses wall-clock end time (`Instant`), not a countdown. Remaining time = `end - Instant::now()` on each 250ms tick.
- Emits `timer-tick` and `timer-complete` events via `app.emit()`. Frontend subscribes via `listen()`.
- States: `Idle -> Running -> Paused -> Running -> Idle` (complete or cancel).
- Commands: `start_timer`, `pause_timer`, `resume_timer`, `cancel_timer`, `get_timer_state` — all generic over `R: Runtime`.
- `AppState` (containing `Mutex<TimerInner>` + DB path) managed via `app.manage()` in setup hook.
- On start: creates `in_progress` interval row. On complete: `completed`. On cancel: `cancelled`.
- Tracks `completed_work_count`: incremented after work, reset after long break.
- Background tick task via `tauri::async_runtime::spawn()`, self-terminates when no longer Running.
- **Break overtime**: optional (`break_overtime_enabled`). Counts up past zero (`-MM:SS` amber). Completes interval at planned duration, enters overtime. Cancel during overtime resets without DB write.
- **Frontend**: Zustand store (`timerStore.ts`) subscribes to events, invokes commands, loads settings. TimerDisplay (MM:SS + SVG ring, color-coded), TimerControls, IntervalTypeSelector, TimerPage ("Pomodoro X of Y").

## Task Management

- Tauri commands in `tasks.rs`: `create_task`, `update_task`, `delete_task`, `complete_task`, `abandon_task`, `reopen_task`, `get_tasks_by_date`, `clone_task`, `reorder_tasks`, `link_tasks_to_interval`, `get_task_interval_counts`.
- Each command opens its own DB connection with `PRAGMA foreign_keys = ON`.
- `complete_task` validates no pending subtasks exist. `clone_task` deep-copies task + subtasks.
- Auto-positioning: `MAX(position) + 1` for the day.
- Status transitions: pending -> completed (subtask check), pending -> abandoned, completed/abandoned -> pending (reopen).
- Delete guard: completed/abandoned cannot be deleted — must reopen first.
- Soft delete with undo: Sonner toast with 10s timeout, actual delete fires after timeout.
- Drag-and-drop: `@dnd-kit` with `DndContext`, `SortableContext`, `PointerSensor` (distance: 8).

## Timer-Task Association

- After **work** interval completes, dialog shows pending parent tasks + pending subtasks. Breaks skip dialog.
- Checkbox cascading: parent checks/unchecks all subtasks; all subtasks checked auto-checks parent.
- On confirm: completes tasks (subtasks first, then parents) with `pomodoroNumber`, links via `link_tasks_to_interval`.
- `completed_in_pomodoro` column (migration v2): which pomodoro a task was completed in. Cleared on reopen.

## Database

- SQLite with 4 tables: `user_settings`, `timer_intervals`, `tasks`, `task_interval_links`.
- Schema via `PRAGMA user_version` (v3). Migration runner in `database.rs`. V1: base schema. V2: `completed_in_pomodoro` + `break_overtime_enabled`. V3: `alarm_volume` default.
- `PRAGMA foreign_keys = ON` on every connection.
- WAL mode for local paths; `journal_mode=DELETE` for cloud-synced paths — auto-detected by `is_cloud_synced_path()`.
- Default DB: `$APPDATA/com.pomo.app/pomo.db`. Custom path via `config.json` in same directory.
- Single-level subtasks via `parent_task_id` (trigger: `enforce_single_level_subtasks`).
- Cross-day copies via `linked_from_task_id` (SET NULL on delete). All timestamps: ISO 8601 UTC.
- Default settings: work=25min, short=5min, long=15min, freq=4, Jira disabled, overtime disabled, alarm=0.6.

## DB Path Configuration

- `config.rs`: `AppConfig { db_path: Option<String> }`, read/write via `read_config()`/`write_config()`.
- `resolve_db_path(app_data_dir)`: returns custom path or default.
- Tauri commands: `get_db_info` (path, is_custom, is_cloud_synced, journal_mode, default_path), `change_db_path` (copies DB + writes config), `reset_db_path` (copies back + clears config).
- Frontend `getDb()` calls `get_db_info` to discover DB path dynamically.
- Settings UI: path display, cloud-sync indicator, Change/Reset buttons, restart notice.

## Settings

- `SettingsPanel.tsx`: shadcn/ui Sheet, gear icon trigger.
- Inputs: work (1-60), short break (1-30), long break (5-60), frequency (1-10). Presets: "25/5", "35/7".
- DB keys: `work_duration_minutes`, `short_break_duration_minutes`, `long_break_duration_minutes`, `long_break_frequency` (string integers). Timer store converts minutes to seconds.

## Alarm Audio

- Chime WAV (`public/sounds/chime.wav`): two-tone bell, ~0.8s, 16-bit mono PCM 44100Hz.
- Primary: Web Audio API (`audio.ts`). `playAlarmChime(volume, repetitions=3)` with 1s gaps.
- Fallback: Rust rodio (`audio.rs`). `play_alarm` with `include_bytes!` WAV on `std::thread`.
- Plays on every `timer-complete` if `alarmVolume > 0`. DB key: `alarm_volume` (real, default 0.6).

## Task History & Cross-Day Copy

- "Copy to Today": `copy_task_to_day` deep-copies task + subtasks with `linked_from_task_id`.
- "Copied from" indicator: clickable link via `get_task_origin_dates`.
- Calendar dots: `get_days_with_tasks` with month-scoped range, loads on popover open/month change.

## Reporting

- Rust commands: `get_daily_summary`, `get_weekly_summary`, `get_monthly_summary` in `reports.rs`.
- Daily: pomodoro count, focus minutes, task ratio, intervals, task groups by jira_key (NULLS LAST).
- Weekly: Mon-Sun per-day stats, aggregate totals, task groups. Monthly: per-week stats clamped to month boundaries.
- Chart.js: `DailyTimeline` (horizontal bar, TimeScale), Weekly/Monthly (vertical bar).
- Report store: lazy-loads on tab switch, manages date navigation state.

## Jira Integration (Future — M7)

- Read-only. HTTP via reqwest from Rust (avoids CORS). Jira Cloud (API token) and Server/DC (PAT).
- Graceful degradation: API unavailable -> save link unverified with UI note.
