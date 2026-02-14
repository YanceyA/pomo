use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, Runtime};

// ── Enums ────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TimerState {
    Idle,
    Running,
    Paused,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntervalType {
    Work,
    ShortBreak,
    LongBreak,
}

impl IntervalType {
    fn as_db_str(self) -> &'static str {
        match self {
            Self::Work => "work",
            Self::ShortBreak => "short_break",
            Self::LongBreak => "long_break",
        }
    }
}

// ── Event payloads ──────────────────────────────────────────

#[derive(Clone, Serialize)]
pub struct TimerTickPayload {
    pub remaining_ms: u64,
    pub interval_type: IntervalType,
    pub overtime_ms: u64,
}

#[derive(Clone, Serialize)]
pub struct TimerCompletePayload {
    pub interval_id: i64,
    pub interval_type: IntervalType,
    pub completed_work_count: u32,
    pub overtime: bool,
}

// ── Timer status (returned by commands) ─────────────────────

#[derive(Clone, Serialize)]
pub struct TimerStatus {
    pub state: TimerState,
    pub interval_type: IntervalType,
    pub remaining_ms: u64,
    pub planned_duration_seconds: u32,
    pub interval_id: Option<i64>,
    pub completed_work_count: u32,
    pub overtime: bool,
    pub overtime_ms: u64,
}

// ── Timer inner state ───────────────────────────────────────

pub struct TimerInner {
    state: TimerState,
    interval_type: IntervalType,
    end_instant: Option<Instant>,
    remaining_ms: u64,
    planned_duration_seconds: u32,
    interval_id: Option<i64>,
    completed_work_count: u32,
    overtime: bool,
    break_overtime_enabled: bool,
    overtime_start: Option<Instant>,
}

/// Convert a `Duration` to milliseconds without truncation casts.
fn duration_to_ms(d: Duration) -> u64 {
    d.as_secs() * 1000 + u64::from(d.subsec_millis())
}

impl TimerInner {
    fn new() -> Self {
        Self {
            state: TimerState::Idle,
            interval_type: IntervalType::Work,
            end_instant: None,
            remaining_ms: 0,
            planned_duration_seconds: 0,
            interval_id: None,
            completed_work_count: 0,
            overtime: false,
            break_overtime_enabled: false,
            overtime_start: None,
        }
    }

    fn compute_remaining_ms(&self) -> u64 {
        if self.overtime {
            return 0;
        }
        match self.state {
            TimerState::Running => self.end_instant.map_or(0, |end| {
                let now = Instant::now();
                if end > now {
                    duration_to_ms(end.duration_since(now))
                } else {
                    0
                }
            }),
            TimerState::Paused => self.remaining_ms,
            TimerState::Idle => 0,
        }
    }

    fn compute_overtime_ms(&self) -> u64 {
        if self.overtime {
            self.overtime_start.map_or(0, |start| {
                duration_to_ms(Instant::now().duration_since(start))
            })
        } else {
            0
        }
    }

    fn enter_overtime(&mut self) {
        self.overtime = true;
        self.overtime_start = Some(Instant::now());
    }

    fn status(&self) -> TimerStatus {
        TimerStatus {
            state: self.state,
            interval_type: self.interval_type,
            remaining_ms: self.compute_remaining_ms(),
            planned_duration_seconds: self.planned_duration_seconds,
            interval_id: self.interval_id,
            completed_work_count: self.completed_work_count,
            overtime: self.overtime,
            overtime_ms: self.compute_overtime_ms(),
        }
    }

    /// Transition from Idle → Running. Returns `Err` if not Idle.
    fn start(
        &mut self,
        interval_type: IntervalType,
        duration_seconds: u32,
        interval_id: i64,
    ) -> Result<(), &'static str> {
        if self.state != TimerState::Idle {
            return Err("Timer is already running or paused");
        }
        self.state = TimerState::Running;
        self.interval_type = interval_type;
        self.planned_duration_seconds = duration_seconds;
        self.interval_id = Some(interval_id);
        self.end_instant =
            Some(Instant::now() + Duration::from_secs(u64::from(duration_seconds)));
        self.remaining_ms = u64::from(duration_seconds) * 1000;
        Ok(())
    }

    /// Transition from Running → Paused. Returns `Err` if not Running.
    fn pause(&mut self) -> Result<(), &'static str> {
        if self.state != TimerState::Running {
            return Err("Timer is not running");
        }
        self.remaining_ms = self.compute_remaining_ms();
        self.state = TimerState::Paused;
        self.end_instant = None;
        Ok(())
    }

    /// Transition from Paused → Running. Returns `Err` if not Paused.
    fn resume(&mut self) -> Result<(), &'static str> {
        if self.state != TimerState::Paused {
            return Err("Timer is not paused");
        }
        self.state = TimerState::Running;
        self.end_instant = Some(Instant::now() + Duration::from_millis(self.remaining_ms));
        Ok(())
    }

    /// Transition from Running|Paused → Idle on cancel.
    /// Returns the elapsed time in seconds (or 0 if in overtime, since interval is already completed).
    fn cancel(&mut self) -> Result<u32, &'static str> {
        if self.state == TimerState::Idle {
            return Err("Timer is not active");
        }

        if self.overtime {
            // Interval already completed in DB — just reset state
            self.state = TimerState::Idle;
            self.end_instant = None;
            self.remaining_ms = 0;
            self.overtime = false;
            self.overtime_start = None;
            self.interval_id = None;
            return Ok(0);
        }

        let remaining_ms = self.compute_remaining_ms();
        let planned_ms = u64::from(self.planned_duration_seconds) * 1000;
        let elapsed_ms = planned_ms.saturating_sub(remaining_ms);
        let elapsed_seconds = elapsed_ms / 1000;

        self.state = TimerState::Idle;
        self.end_instant = None;
        self.remaining_ms = 0;
        self.overtime = false;
        self.overtime_start = None;
        // interval_id is intentionally NOT cleared here — caller reads it before reset
        Ok(u32::try_from(elapsed_seconds).unwrap_or(u32::MAX))
    }

    /// Mark the current interval as complete and update work count.
    fn complete(&mut self) {
        match self.interval_type {
            IntervalType::Work => self.completed_work_count += 1,
            IntervalType::LongBreak => self.completed_work_count = 0,
            IntervalType::ShortBreak => {}
        }
        self.state = TimerState::Idle;
        self.end_instant = None;
        self.remaining_ms = 0;
        self.interval_id = None;
        self.overtime = false;
        self.overtime_start = None;
    }
}

// ── App state ───────────────────────────────────────────────

pub struct AppState {
    pub timer: Mutex<TimerInner>,
    pub db_path: PathBuf,
}

impl AppState {
    pub fn new(db_path: PathBuf) -> Self {
        Self {
            timer: Mutex::new(TimerInner::new()),
            db_path,
        }
    }
}

// ── Database helpers ────────────────────────────────────────

fn open_db(db_path: &Path) -> Result<Connection, String> {
    Connection::open(db_path).map_err(|e| format!("Failed to open database: {e}"))
}

fn db_insert_interval(
    db_path: &Path,
    interval_type: IntervalType,
    start_time: &str,
    planned_duration_seconds: u32,
) -> Result<i64, String> {
    let conn = open_db(db_path)?;
    conn.execute(
        "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status) \
         VALUES (?1, ?2, ?3, 'in_progress')",
        rusqlite::params![
            interval_type.as_db_str(),
            start_time,
            planned_duration_seconds
        ],
    )
    .map_err(|e| format!("Failed to insert interval: {e}"))?;
    Ok(conn.last_insert_rowid())
}

fn db_complete_interval(
    db_path: &Path,
    id: i64,
    end_time: &str,
    duration_seconds: u32,
) -> Result<(), String> {
    let conn = open_db(db_path)?;
    conn.execute(
        "UPDATE timer_intervals \
         SET status = 'completed', end_time = ?1, duration_seconds = ?2 \
         WHERE id = ?3",
        rusqlite::params![end_time, duration_seconds, id],
    )
    .map_err(|e| format!("Failed to complete interval: {e}"))?;
    Ok(())
}

fn db_cancel_interval(
    db_path: &Path,
    id: i64,
    end_time: &str,
    duration_seconds: u32,
) -> Result<(), String> {
    let conn = open_db(db_path)?;
    conn.execute(
        "UPDATE timer_intervals \
         SET status = 'cancelled', end_time = ?1, duration_seconds = ?2 \
         WHERE id = ?3",
        rusqlite::params![end_time, duration_seconds, id],
    )
    .map_err(|e| format!("Failed to cancel interval: {e}"))?;
    Ok(())
}

// ── Background tick task ────────────────────────────────────

fn spawn_tick_task<R: Runtime>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let mut ticker = tokio::time::interval(Duration::from_millis(250));

        loop {
            ticker.tick().await;

            let state = app.state::<AppState>();

            // Read state under lock, release quickly
            let tick_data = {
                let timer = state.timer.lock().expect("timer lock poisoned");
                if timer.state != TimerState::Running {
                    return; // Timer no longer running — exit task
                }

                // In overtime mode, keep ticking with overtime_ms
                if timer.overtime {
                    let overtime_ms = timer.compute_overtime_ms();
                    let _ = app.emit(
                        "timer-tick",
                        TimerTickPayload {
                            remaining_ms: 0,
                            interval_type: timer.interval_type,
                            overtime_ms,
                        },
                    );
                    continue;
                }

                let Some(end) = timer.end_instant else {
                    return;
                };
                (
                    end,
                    timer.interval_type,
                    timer.interval_id.unwrap_or(0),
                    timer.planned_duration_seconds,
                    timer.break_overtime_enabled,
                )
            };

            let (end, interval_type, interval_id, planned, break_overtime_enabled) = tick_data;
            let now = Instant::now();

            if now >= end {
                let is_break = matches!(interval_type, IntervalType::ShortBreak | IntervalType::LongBreak);

                if is_break && break_overtime_enabled {
                    // Complete the interval in DB, enter overtime mode
                    let db_path = state.db_path.clone();
                    let completed_work_count = {
                        let mut timer = state.timer.lock().expect("timer lock poisoned");
                        if timer.state != TimerState::Running {
                            return;
                        }
                        timer.complete();
                        let cwc = timer.completed_work_count;
                        // Re-enter Running state for overtime display
                        timer.state = TimerState::Running;
                        timer.interval_type = interval_type;
                        timer.enter_overtime();
                        cwc
                    };

                    let end_time = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
                    let _ = db_complete_interval(&db_path, interval_id, &end_time, planned);

                    let _ = app.emit(
                        "timer-complete",
                        TimerCompletePayload {
                            interval_id,
                            interval_type,
                            completed_work_count,
                            overtime: true,
                        },
                    );

                    // Continue loop — don't return, overtime ticking will happen
                    continue;
                }

                // Normal completion
                let db_path = state.db_path.clone();
                let completed_work_count = {
                    let mut timer = state.timer.lock().expect("timer lock poisoned");
                    // Guard against race: another command may have changed state
                    if timer.state != TimerState::Running {
                        return;
                    }
                    timer.complete();
                    timer.completed_work_count
                };

                let end_time = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
                let _ = db_complete_interval(&db_path, interval_id, &end_time, planned);

                let _ = app.emit(
                    "timer-complete",
                    TimerCompletePayload {
                        interval_id,
                        interval_type,
                        completed_work_count,
                        overtime: false,
                    },
                );

                return;
            }

            // Normal tick
            let remaining_ms = duration_to_ms(end.duration_since(now));
            let _ = app.emit(
                "timer-tick",
                TimerTickPayload {
                    remaining_ms,
                    interval_type,
                    overtime_ms: 0,
                },
            );
        }
    });
}

// ── Tauri commands ──────────────────────────────────────────
// `tauri::State` is injected by value per Tauri's command API; clippy's
// suggestion to take a reference does not compile with the framework.
#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn start_timer<R: Runtime>(
    state: tauri::State<'_, AppState>,
    app: AppHandle<R>,
    interval_type: IntervalType,
    duration_seconds: u32,
) -> Result<TimerStatus, String> {
    if duration_seconds == 0 {
        return Err("Duration must be greater than zero".into());
    }

    // Read break overtime setting from DB
    let break_overtime_enabled = {
        let conn = open_db(&state.db_path)?;
        conn.query_row(
            "SELECT value FROM user_settings WHERE key = 'break_overtime_enabled'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "false".to_string())
            == "true"
    };

    let start_time = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let interval_id =
        db_insert_interval(&state.db_path, interval_type, &start_time, duration_seconds)?;

    let status = {
        let mut timer = state
            .timer
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        timer.break_overtime_enabled = break_overtime_enabled;
        timer
            .start(interval_type, duration_seconds, interval_id)
            .map_err(String::from)?;
        timer.status()
    };

    spawn_tick_task(app);
    Ok(status)
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn pause_timer(state: tauri::State<'_, AppState>) -> Result<TimerStatus, String> {
    let mut timer = state
        .timer
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    timer.pause().map_err(String::from)?;
    Ok(timer.status())
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn resume_timer<R: Runtime>(
    state: tauri::State<'_, AppState>,
    app: AppHandle<R>,
) -> Result<TimerStatus, String> {
    let status = {
        let mut timer = state
            .timer
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        timer.resume().map_err(String::from)?;
        timer.status()
    };

    spawn_tick_task(app);
    Ok(status)
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn cancel_timer(state: tauri::State<'_, AppState>) -> Result<TimerStatus, String> {
    let (interval_id, elapsed_seconds, was_overtime, status) = {
        let mut timer = state
            .timer
            .lock()
            .map_err(|e| format!("Lock error: {e}"))?;
        let id = timer.interval_id.unwrap_or(0);
        let was_ot = timer.overtime;
        let elapsed = timer.cancel().map_err(String::from)?;
        if !was_ot {
            timer.interval_id = None;
        }
        (id, elapsed, was_ot, timer.status())
    };

    // If in overtime, interval is already completed in DB — don't write again
    if !was_overtime {
        let end_time = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        db_cancel_interval(&state.db_path, interval_id, &end_time, elapsed_seconds)?;
    }

    Ok(status)
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn get_timer_state(state: tauri::State<'_, AppState>) -> Result<TimerStatus, String> {
    let timer = state
        .timer
        .lock()
        .map_err(|e| format!("Lock error: {e}"))?;
    Ok(timer.status())
}

// ── Tests ───────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // ── State machine tests ─────────────────────────────────

    #[test]
    fn new_timer_is_idle() {
        let timer = TimerInner::new();
        assert_eq!(timer.state, TimerState::Idle);
        assert_eq!(timer.completed_work_count, 0);
    }

    #[test]
    fn idle_to_running() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        assert_eq!(timer.state, TimerState::Running);
        assert_eq!(timer.interval_type, IntervalType::Work);
        assert_eq!(timer.planned_duration_seconds, 1500);
        assert_eq!(timer.interval_id, Some(1));
        assert!(timer.end_instant.is_some());
    }

    #[test]
    fn running_to_paused() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.pause().unwrap();
        assert_eq!(timer.state, TimerState::Paused);
        assert!(timer.end_instant.is_none());
        assert!(timer.remaining_ms > 0);
    }

    #[test]
    fn paused_to_running() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.pause().unwrap();
        timer.resume().unwrap();
        assert_eq!(timer.state, TimerState::Running);
        assert!(timer.end_instant.is_some());
    }

    #[test]
    fn running_to_idle_on_cancel() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        let elapsed = timer.cancel().unwrap();
        assert_eq!(timer.state, TimerState::Idle);
        // Timer just started so elapsed should be ~0
        assert!(elapsed <= 1);
    }

    #[test]
    fn paused_to_idle_on_cancel() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.pause().unwrap();
        timer.cancel().unwrap();
        assert_eq!(timer.state, TimerState::Idle);
    }

    #[test]
    fn cannot_start_when_running() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        assert!(timer.start(IntervalType::Work, 1500, 2).is_err());
    }

    #[test]
    fn cannot_start_when_paused() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.pause().unwrap();
        assert!(timer.start(IntervalType::Work, 1500, 2).is_err());
    }

    #[test]
    fn cannot_pause_when_idle() {
        let mut timer = TimerInner::new();
        assert!(timer.pause().is_err());
    }

    #[test]
    fn cannot_pause_when_paused() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.pause().unwrap();
        assert!(timer.pause().is_err());
    }

    #[test]
    fn cannot_resume_when_idle() {
        let mut timer = TimerInner::new();
        assert!(timer.resume().is_err());
    }

    #[test]
    fn cannot_resume_when_running() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        assert!(timer.resume().is_err());
    }

    #[test]
    fn cannot_cancel_when_idle() {
        let mut timer = TimerInner::new();
        assert!(timer.cancel().is_err());
    }

    // ── Completion and work count tests ─────────────────────

    #[test]
    fn work_completion_increments_count() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 25, 1).unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 1);
        assert_eq!(timer.state, TimerState::Idle);
        assert!(timer.interval_id.is_none());
    }

    #[test]
    fn multiple_work_completions_accumulate() {
        let mut timer = TimerInner::new();
        for i in 1..=4 {
            timer.start(IntervalType::Work, 25, i64::from(i)).unwrap();
            timer.complete();
        }
        assert_eq!(timer.completed_work_count, 4);
    }

    #[test]
    fn long_break_resets_work_count() {
        let mut timer = TimerInner::new();
        // Complete 4 work intervals
        for i in 1..=4 {
            timer.start(IntervalType::Work, 25, i64::from(i)).unwrap();
            timer.complete();
        }
        assert_eq!(timer.completed_work_count, 4);

        // Complete a long break
        timer.start(IntervalType::LongBreak, 15, 5).unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 0);
    }

    #[test]
    fn short_break_does_not_change_count() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 25, 1).unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 1);

        timer.start(IntervalType::ShortBreak, 5, 2).unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 1);
    }

    #[test]
    fn cancel_does_not_change_work_count() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 25, 1).unwrap();
        timer.cancel().unwrap();
        assert_eq!(timer.completed_work_count, 0);
    }

    // ── Status reporting tests ──────────────────────────────

    #[test]
    fn idle_status_has_zero_remaining() {
        let timer = TimerInner::new();
        let status = timer.status();
        assert_eq!(status.state, TimerState::Idle);
        assert_eq!(status.remaining_ms, 0);
    }

    #[test]
    fn running_status_has_positive_remaining() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        let status = timer.status();
        assert_eq!(status.state, TimerState::Running);
        assert!(status.remaining_ms > 0);
        assert_eq!(status.planned_duration_seconds, 1500);
    }

    #[test]
    fn paused_status_preserves_remaining() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.pause().unwrap();
        let status = timer.status();
        assert_eq!(status.state, TimerState::Paused);
        assert!(status.remaining_ms > 0);
    }

    // ── Interval type serialization tests ───────────────────

    #[test]
    fn interval_type_db_strings() {
        assert_eq!(IntervalType::Work.as_db_str(), "work");
        assert_eq!(IntervalType::ShortBreak.as_db_str(), "short_break");
        assert_eq!(IntervalType::LongBreak.as_db_str(), "long_break");
    }

    #[test]
    fn interval_type_serde_roundtrip() {
        let json = serde_json::to_string(&IntervalType::ShortBreak).unwrap();
        assert_eq!(json, "\"short_break\"");
        let parsed: IntervalType = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, IntervalType::ShortBreak);
    }

    #[test]
    fn timer_state_serde_roundtrip() {
        let json = serde_json::to_string(&TimerState::Running).unwrap();
        assert_eq!(json, "\"running\"");
        let parsed: TimerState = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, TimerState::Running);
    }

    // ── Database operation tests ────────────────────────────

    /// Helper: create an in-memory database with migrations applied.
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        crate::database::run_migrations(&conn).unwrap();
        conn
    }

    #[test]
    fn insert_interval_creates_in_progress_row() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status) \
             VALUES ('work', '2026-02-14T09:00:00Z', 1500, 'in_progress')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        let (status, itype, planned): (String, String, u32) = conn
            .query_row(
                "SELECT status, interval_type, planned_duration_seconds FROM timer_intervals WHERE id = ?1",
                [id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, u32>(2)?)),
            )
            .unwrap();

        assert_eq!(status, "in_progress");
        assert_eq!(itype, "work");
        assert_eq!(planned, 1500);
    }

    #[test]
    fn complete_interval_sets_correct_fields() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status) \
             VALUES ('work', '2026-02-14T09:00:00Z', 1500, 'in_progress')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        conn.execute(
            "UPDATE timer_intervals SET status = 'completed', end_time = ?1, duration_seconds = ?2 WHERE id = ?3",
            rusqlite::params!["2026-02-14T09:25:00Z", 1500, id],
        )
        .unwrap();

        let (status, end_time, duration): (String, String, u32) = conn
            .query_row(
                "SELECT status, end_time, duration_seconds FROM timer_intervals WHERE id = ?1",
                [id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, u32>(2)?)),
            )
            .unwrap();

        assert_eq!(status, "completed");
        assert_eq!(end_time, "2026-02-14T09:25:00Z");
        assert_eq!(duration, 1500);
    }

    #[test]
    fn cancel_interval_sets_cancelled_status() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status) \
             VALUES ('work', '2026-02-14T09:00:00Z', 1500, 'in_progress')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        conn.execute(
            "UPDATE timer_intervals SET status = 'cancelled', end_time = ?1, duration_seconds = ?2 WHERE id = ?3",
            rusqlite::params!["2026-02-14T09:10:00Z", 600, id],
        )
        .unwrap();

        let (status, duration): (String, u32) = conn
            .query_row(
                "SELECT status, duration_seconds FROM timer_intervals WHERE id = ?1",
                [id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, u32>(1)?)),
            )
            .unwrap();

        assert_eq!(status, "cancelled");
        assert_eq!(duration, 600);
    }

    #[test]
    fn all_interval_types_insert_correctly() {
        let conn = setup_test_db();
        for interval_type in ["work", "short_break", "long_break"] {
            conn.execute(
                "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds) \
                 VALUES (?1, '2026-02-14T09:00:00Z', 1500)",
                [interval_type],
            )
            .unwrap();
        }

        let count: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM timer_intervals",
                [],
                |row| row.get::<_, u32>(0),
            )
            .unwrap();
        assert_eq!(count, 3);
    }

    // ── Full cycle tests ────────────────────────────────────

    #[test]
    fn full_work_cycle_start_complete() {
        let mut timer = TimerInner::new();
        assert_eq!(timer.state, TimerState::Idle);

        timer.start(IntervalType::Work, 1500, 1).unwrap();
        assert_eq!(timer.state, TimerState::Running);

        timer.complete();
        assert_eq!(timer.state, TimerState::Idle);
        assert_eq!(timer.completed_work_count, 1);
    }

    #[test]
    fn full_cycle_with_pause_resume() {
        let mut timer = TimerInner::new();

        timer.start(IntervalType::Work, 1500, 1).unwrap();
        assert_eq!(timer.state, TimerState::Running);

        timer.pause().unwrap();
        assert_eq!(timer.state, TimerState::Paused);

        timer.resume().unwrap();
        assert_eq!(timer.state, TimerState::Running);

        timer.complete();
        assert_eq!(timer.state, TimerState::Idle);
        assert_eq!(timer.completed_work_count, 1);
    }

    #[test]
    fn long_break_after_four_work_intervals() {
        let mut timer = TimerInner::new();
        let long_break_frequency: u32 = 4;

        for i in 0..long_break_frequency {
            timer
                .start(IntervalType::Work, 1500, i64::from(i) + 1)
                .unwrap();
            timer.complete();
        }

        assert_eq!(timer.completed_work_count, long_break_frequency);

        // After long break, count resets
        timer
            .start(IntervalType::LongBreak, 900, 5)
            .unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 0);

        // Can start new work cycle
        timer.start(IntervalType::Work, 1500, 6).unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 1);
    }

    // ── Overtime tests ──────────────────────────────────────

    #[test]
    fn new_timer_has_overtime_disabled() {
        let timer = TimerInner::new();
        assert!(!timer.overtime);
        assert!(!timer.break_overtime_enabled);
        assert!(timer.overtime_start.is_none());
    }

    #[test]
    fn enter_overtime_sets_flag() {
        let mut timer = TimerInner::new();
        timer.state = TimerState::Running;
        timer.enter_overtime();
        assert!(timer.overtime);
        assert!(timer.overtime_start.is_some());
    }

    #[test]
    fn cancel_during_overtime_resets_to_idle() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::ShortBreak, 300, 1).unwrap();
        timer.complete(); // Simulate break completion
        timer.state = TimerState::Running; // Re-enter for overtime
        timer.overtime = true;
        timer.overtime_start = Some(Instant::now());

        let elapsed = timer.cancel().unwrap();
        assert_eq!(timer.state, TimerState::Idle);
        assert!(!timer.overtime);
        assert!(timer.overtime_start.is_none());
        assert_eq!(elapsed, 0); // Overtime cancel returns 0
    }

    #[test]
    fn cancel_during_overtime_does_not_change_work_count() {
        let mut timer = TimerInner::new();
        // Complete a work interval first
        timer.start(IntervalType::Work, 25, 1).unwrap();
        timer.complete();
        assert_eq!(timer.completed_work_count, 1);

        // Start break, enter overtime
        timer.start(IntervalType::ShortBreak, 5, 2).unwrap();
        timer.complete();
        timer.state = TimerState::Running;
        timer.overtime = true;
        timer.overtime_start = Some(Instant::now());

        timer.cancel().unwrap();
        assert_eq!(timer.completed_work_count, 1); // Unchanged
    }

    #[test]
    fn overtime_compute_ms_is_zero_when_not_overtime() {
        let timer = TimerInner::new();
        assert_eq!(timer.compute_overtime_ms(), 0);
    }

    #[test]
    fn can_restart_after_cancel() {
        let mut timer = TimerInner::new();
        timer.start(IntervalType::Work, 1500, 1).unwrap();
        timer.cancel().unwrap();
        assert_eq!(timer.state, TimerState::Idle);

        // Should be able to start again
        timer.start(IntervalType::Work, 1500, 2).unwrap();
        assert_eq!(timer.state, TimerState::Running);
    }
}
