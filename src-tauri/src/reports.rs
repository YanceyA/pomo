use rusqlite::Connection;
use serde::Serialize;
use std::path::Path;

use crate::timer::AppState;

// ── Types ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct IntervalSummary {
    pub id: i64,
    pub interval_type: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: i64,
    pub planned_duration_seconds: i64,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskSummary {
    pub id: i64,
    pub title: String,
    pub status: String,
    pub jira_key: Option<String>,
    pub tag: Option<String>,
    pub completed_in_pomodoro: Option<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaskGroup {
    pub jira_key: Option<String>,
    pub tasks: Vec<TaskSummary>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailySummary {
    pub date: String,
    pub pomodoro_count: i64,
    pub total_focus_minutes: i64,
    pub tasks_completed: i64,
    pub tasks_total: i64,
    pub intervals: Vec<IntervalSummary>,
    pub task_groups: Vec<TaskGroup>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DailyStat {
    pub date: String,
    pub pomodoro_count: i64,
    pub focus_minutes: i64,
    pub tasks_completed: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WeeklySummary {
    pub week_start: String,
    pub week_end: String,
    pub daily_stats: Vec<DailyStat>,
    pub total_pomodoros: i64,
    pub total_focus_minutes: i64,
    pub total_tasks_completed: i64,
    pub task_groups: Vec<TaskGroup>,
}

// ── Database helpers ────────────────────────────────────────

fn open_db(db_path: &Path) -> Result<Connection, String> {
    let conn =
        Connection::open(db_path).map_err(|e| format!("Failed to open database: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to set pragmas: {e}"))?;
    Ok(conn)
}

fn query_pomodoro_stats(
    conn: &Connection,
    day_date: &str,
) -> Result<(i64, i64), String> {
    conn.query_row(
        "SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
         FROM timer_intervals
         WHERE status = 'completed' AND interval_type = 'work'
           AND date(start_time) = ?1",
        [day_date],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )
    .map_err(|e| format!("Failed to query pomodoro stats: {e}"))
}

fn query_task_counts(
    conn: &Connection,
    day_date: &str,
) -> Result<(i64, i64), String> {
    let completed: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks
             WHERE day_date = ?1 AND status = 'completed' AND parent_task_id IS NULL",
            [day_date],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query completed tasks: {e}"))?;

    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks
             WHERE day_date = ?1 AND parent_task_id IS NULL",
            [day_date],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query total tasks: {e}"))?;

    Ok((completed, total))
}

fn query_intervals(
    conn: &Connection,
    day_date: &str,
) -> Result<Vec<IntervalSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, interval_type, start_time, end_time,
                    duration_seconds, planned_duration_seconds, status
             FROM timer_intervals
             WHERE date(start_time) = ?1 AND status = 'completed'
             ORDER BY start_time ASC",
        )
        .map_err(|e| format!("Failed to prepare intervals query: {e}"))?;

    let rows = stmt
        .query_map([day_date], |row| {
            Ok(IntervalSummary {
                id: row.get(0)?,
                interval_type: row.get(1)?,
                start_time: row.get(2)?,
                end_time: row.get(3)?,
                duration_seconds: row.get(4)?,
                planned_duration_seconds: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to query intervals: {e}"))?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect intervals: {e}"))
}

fn query_task_groups(
    conn: &Connection,
    start_date: &str,
    end_date: &str,
) -> Result<Vec<TaskGroup>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, status, jira_key, tag, completed_in_pomodoro
             FROM tasks
             WHERE day_date BETWEEN ?1 AND ?2
               AND parent_task_id IS NULL
             ORDER BY jira_key NULLS LAST, day_date, position",
        )
        .map_err(|e| format!("Failed to prepare task groups query: {e}"))?;

    let tasks: Vec<TaskSummary> = stmt
        .query_map([start_date, end_date], |row| {
            Ok(TaskSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                jira_key: row.get(3)?,
                tag: row.get(4)?,
                completed_in_pomodoro: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query tasks: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect tasks: {e}"))?;

    // Group by jira_key
    let mut groups: Vec<TaskGroup> = Vec::new();
    for task in tasks {
        let key = task.jira_key.clone();
        if let Some(group) = groups.iter_mut().find(|g| g.jira_key == key) {
            group.tasks.push(task);
        } else {
            groups.push(TaskGroup {
                jira_key: key,
                tasks: vec![task],
            });
        }
    }

    Ok(groups)
}

// ── Tauri commands ──────────────────────────────────────────

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn get_daily_summary(
    state: tauri::State<'_, AppState>,
    day_date: String,
) -> Result<DailySummary, String> {
    let conn = open_db(&state.db_path)?;

    let (pomodoro_count, total_focus_seconds) = query_pomodoro_stats(&conn, &day_date)?;
    let (tasks_completed, tasks_total) = query_task_counts(&conn, &day_date)?;
    let intervals = query_intervals(&conn, &day_date)?;
    let task_groups = query_task_groups(&conn, &day_date, &day_date)?;

    Ok(DailySummary {
        date: day_date,
        pomodoro_count,
        total_focus_minutes: total_focus_seconds / 60,
        tasks_completed,
        tasks_total,
        intervals,
        task_groups,
    })
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn get_weekly_summary(
    state: tauri::State<'_, AppState>,
    week_start: String,
) -> Result<WeeklySummary, String> {
    let conn = open_db(&state.db_path)?;

    // Compute week_end (6 days after week_start)
    let week_end = conn
        .query_row(
            "SELECT date(?1, '+6 days')",
            [&week_start],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Failed to compute week end: {e}"))?;

    // Get per-day pomodoro stats
    let mut pomo_stmt = conn
        .prepare(
            "SELECT date(start_time) as day,
                    COUNT(*) as pomo_count,
                    COALESCE(SUM(duration_seconds), 0) as focus_secs
             FROM timer_intervals
             WHERE status = 'completed' AND interval_type = 'work'
               AND date(start_time) BETWEEN ?1 AND ?2
             GROUP BY date(start_time)",
        )
        .map_err(|e| format!("Failed to prepare weekly pomo query: {e}"))?;

    let pomo_rows: Vec<(String, i64, i64)> = pomo_stmt
        .query_map([&week_start, &week_end], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| format!("Failed to query weekly pomos: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect weekly pomos: {e}"))?;

    // Get per-day completed tasks
    let mut task_stmt = conn
        .prepare(
            "SELECT day_date, COUNT(*) as completed_count
             FROM tasks
             WHERE day_date BETWEEN ?1 AND ?2
               AND status = 'completed'
               AND parent_task_id IS NULL
             GROUP BY day_date",
        )
        .map_err(|e| format!("Failed to prepare weekly tasks query: {e}"))?;

    let task_rows: Vec<(String, i64)> = task_stmt
        .query_map([&week_start, &week_end], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|e| format!("Failed to query weekly tasks: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect weekly tasks: {e}"))?;

    // Build daily stats for all 7 days
    let mut daily_stats: Vec<DailyStat> = Vec::new();
    let mut current = week_start.clone();
    for _ in 0..7 {
        let pomo = pomo_rows.iter().find(|(d, _, _)| *d == current);
        let tasks = task_rows.iter().find(|(d, _)| *d == current);

        daily_stats.push(DailyStat {
            date: current.clone(),
            pomodoro_count: pomo.map_or(0, |(_, c, _)| *c),
            focus_minutes: pomo.map_or(0, |(_, _, s)| *s / 60),
            tasks_completed: tasks.map_or(0, |(_, c)| *c),
        });

        // Advance to next day using SQLite date()
        current = conn
            .query_row(
                "SELECT date(?1, '+1 day')",
                [&current],
                |row| row.get::<_, String>(0),
            )
            .map_err(|e| format!("Failed to advance date: {e}"))?;
    }

    let total_pomodoros = daily_stats.iter().map(|d| d.pomodoro_count).sum();
    let total_focus_minutes = daily_stats.iter().map(|d| d.focus_minutes).sum();
    let total_tasks_completed = daily_stats.iter().map(|d| d.tasks_completed).sum();

    let task_groups = query_task_groups(&conn, &week_start, &week_end)?;

    Ok(WeeklySummary {
        week_start,
        week_end,
        daily_stats,
        total_pomodoros,
        total_focus_minutes,
        total_tasks_completed,
        task_groups,
    })
}

// ── Tests ───────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use crate::database;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to open in-memory DB");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("Failed to enable foreign keys");
        database::run_migrations(&conn).expect("Failed to run migrations");
        conn
    }

    fn insert_interval(
        conn: &Connection,
        interval_type: &str,
        start_time: &str,
        end_time: &str,
        duration_seconds: i64,
        status: &str,
    ) -> i64 {
        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, end_time,
             duration_seconds, planned_duration_seconds, status, created_at)
             VALUES (?1, ?2, ?3, ?4, ?4, ?5, ?2)",
            rusqlite::params![interval_type, start_time, end_time, duration_seconds, status],
        )
        .expect("Failed to insert interval");
        conn.last_insert_rowid()
    }

    fn insert_task(
        conn: &Connection,
        title: &str,
        day_date: &str,
        status: &str,
        jira_key: Option<&str>,
        position: i64,
    ) -> i64 {
        let now = "2026-02-15T09:00:00Z";
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, parent_task_id,
             linked_from_task_id, jira_key, tag, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, NULL, NULL, ?4, NULL, ?5, ?6, ?6)",
            rusqlite::params![title, day_date, status, jira_key, position, now],
        )
        .expect("Failed to insert task");
        conn.last_insert_rowid()
    }

    fn insert_subtask(
        conn: &Connection,
        title: &str,
        day_date: &str,
        status: &str,
        parent_id: i64,
    ) -> i64 {
        let now = "2026-02-15T09:00:00Z";
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, parent_task_id,
             linked_from_task_id, jira_key, tag, position, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, NULL, NULL, NULL, 0, ?5, ?5)",
            rusqlite::params![title, day_date, status, parent_id, now],
        )
        .expect("Failed to insert subtask");
        conn.last_insert_rowid()
    }

    // ── Daily summary tests ──────────────────────────────────

    #[test]
    fn daily_summary_empty_day() {
        let conn = setup_test_db();
        let (pomo_count, focus_secs) = query_pomodoro_stats(&conn, "2026-02-15").unwrap();
        let (completed, total) = query_task_counts(&conn, "2026-02-15").unwrap();
        let intervals = query_intervals(&conn, "2026-02-15").unwrap();

        assert_eq!(pomo_count, 0);
        assert_eq!(focus_secs, 0);
        assert_eq!(completed, 0);
        assert_eq!(total, 0);
        assert!(intervals.is_empty());
    }

    #[test]
    fn daily_summary_counts_work_intervals_only() {
        let conn = setup_test_db();
        insert_interval(&conn, "work", "2026-02-15T09:00:00Z", "2026-02-15T09:25:00Z", 1500, "completed");
        insert_interval(&conn, "work", "2026-02-15T10:00:00Z", "2026-02-15T10:25:00Z", 1500, "completed");
        insert_interval(&conn, "short_break", "2026-02-15T09:25:00Z", "2026-02-15T09:30:00Z", 300, "completed");
        insert_interval(&conn, "work", "2026-02-15T11:00:00Z", "2026-02-15T11:25:00Z", 1500, "cancelled");

        let (pomo_count, focus_secs) = query_pomodoro_stats(&conn, "2026-02-15").unwrap();
        assert_eq!(pomo_count, 2);
        assert_eq!(focus_secs, 3000);
    }

    #[test]
    fn daily_summary_intervals_ordered_by_time() {
        let conn = setup_test_db();
        insert_interval(&conn, "work", "2026-02-15T10:00:00Z", "2026-02-15T10:25:00Z", 1500, "completed");
        insert_interval(&conn, "short_break", "2026-02-15T09:25:00Z", "2026-02-15T09:30:00Z", 300, "completed");
        insert_interval(&conn, "work", "2026-02-15T09:00:00Z", "2026-02-15T09:25:00Z", 1500, "completed");

        let intervals = query_intervals(&conn, "2026-02-15").unwrap();
        assert_eq!(intervals.len(), 3);
        assert_eq!(intervals[0].start_time, "2026-02-15T09:00:00Z");
        assert_eq!(intervals[1].start_time, "2026-02-15T09:25:00Z");
        assert_eq!(intervals[2].start_time, "2026-02-15T10:00:00Z");
    }

    #[test]
    fn daily_summary_task_counts() {
        let conn = setup_test_db();
        insert_task(&conn, "Task 1", "2026-02-15", "completed", None, 0);
        insert_task(&conn, "Task 2", "2026-02-15", "pending", None, 1);
        insert_task(&conn, "Task 3", "2026-02-15", "abandoned", None, 2);
        // Subtask should not be counted in totals
        let parent_id = insert_task(&conn, "Parent", "2026-02-15", "completed", None, 3);
        insert_subtask(&conn, "Sub 1", "2026-02-15", "completed", parent_id);

        let (completed, total) = query_task_counts(&conn, "2026-02-15").unwrap();
        assert_eq!(completed, 2); // Task 1 + Parent
        assert_eq!(total, 4); // Task 1 + Task 2 + Task 3 + Parent (not subtask)
    }

    #[test]
    fn daily_summary_groups_by_jira_key() {
        let conn = setup_test_db();
        insert_task(&conn, "Task A1", "2026-02-15", "completed", Some("PROJ-1"), 0);
        insert_task(&conn, "Task A2", "2026-02-15", "pending", Some("PROJ-1"), 1);
        insert_task(&conn, "Task B1", "2026-02-15", "completed", Some("PROJ-2"), 2);
        insert_task(&conn, "No Jira", "2026-02-15", "pending", None, 3);

        let groups = query_task_groups(&conn, "2026-02-15", "2026-02-15").unwrap();
        assert_eq!(groups.len(), 3); // PROJ-1, PROJ-2, NULL
        assert_eq!(groups[0].jira_key, Some("PROJ-1".to_string()));
        assert_eq!(groups[0].tasks.len(), 2);
        assert_eq!(groups[1].jira_key, Some("PROJ-2".to_string()));
        assert_eq!(groups[1].tasks.len(), 1);
        assert_eq!(groups[2].jira_key, None);
        assert_eq!(groups[2].tasks.len(), 1);
    }

    #[test]
    fn daily_summary_excludes_other_days() {
        let conn = setup_test_db();
        insert_interval(&conn, "work", "2026-02-15T09:00:00Z", "2026-02-15T09:25:00Z", 1500, "completed");
        insert_interval(&conn, "work", "2026-02-14T09:00:00Z", "2026-02-14T09:25:00Z", 1500, "completed");
        insert_task(&conn, "Today Task", "2026-02-15", "completed", None, 0);
        insert_task(&conn, "Yesterday Task", "2026-02-14", "completed", None, 0);

        let (pomo_count, _) = query_pomodoro_stats(&conn, "2026-02-15").unwrap();
        let (completed, total) = query_task_counts(&conn, "2026-02-15").unwrap();
        assert_eq!(pomo_count, 1);
        assert_eq!(completed, 1);
        assert_eq!(total, 1);
    }

    // ── Weekly summary tests ─────────────────────────────────

    #[test]
    fn weekly_summary_empty_week() {
        let conn = setup_test_db();
        let week_end: String = conn
            .query_row("SELECT date('2026-02-10', '+6 days')", [], |row| row.get(0))
            .unwrap();

        // Verify helper queries return zeros
        let mut daily: Vec<DailyStat> = Vec::new();
        let mut current = "2026-02-10".to_string();
        for _ in 0..7 {
            let (pomo_count, focus_secs) = query_pomodoro_stats(&conn, &current).unwrap();
            let (completed, _) = query_task_counts(&conn, &current).unwrap();
            daily.push(DailyStat {
                date: current.clone(),
                pomodoro_count: pomo_count,
                focus_minutes: focus_secs / 60,
                tasks_completed: completed,
            });
            current = conn
                .query_row("SELECT date(?1, '+1 day')", [&current], |row| row.get::<_, String>(0))
                .unwrap();
        }

        assert_eq!(daily.len(), 7);
        assert_eq!(week_end, "2026-02-16");
        assert!(daily.iter().all(|d| d.pomodoro_count == 0));
    }

    #[test]
    fn weekly_summary_aggregates_across_days() {
        let conn = setup_test_db();
        // Monday
        insert_interval(&conn, "work", "2026-02-10T09:00:00Z", "2026-02-10T09:25:00Z", 1500, "completed");
        insert_interval(&conn, "work", "2026-02-10T10:00:00Z", "2026-02-10T10:25:00Z", 1500, "completed");
        insert_task(&conn, "Mon Task", "2026-02-10", "completed", None, 0);
        // Wednesday
        insert_interval(&conn, "work", "2026-02-12T09:00:00Z", "2026-02-12T09:25:00Z", 1500, "completed");
        insert_task(&conn, "Wed Task", "2026-02-12", "completed", None, 0);
        // Friday
        insert_task(&conn, "Fri Task", "2026-02-14", "completed", None, 0);

        // Query per-day pomodoro stats
        let mut pomo_stmt = conn
            .prepare(
                "SELECT date(start_time), COUNT(*), COALESCE(SUM(duration_seconds), 0)
                 FROM timer_intervals
                 WHERE status = 'completed' AND interval_type = 'work'
                   AND date(start_time) BETWEEN '2026-02-10' AND '2026-02-16'
                 GROUP BY date(start_time)",
            )
            .unwrap();
        let pomo_rows: Vec<(String, i64, i64)> = pomo_stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(pomo_rows.len(), 2); // Mon + Wed
        assert_eq!(pomo_rows[0], ("2026-02-10".to_string(), 2, 3000));
        assert_eq!(pomo_rows[1], ("2026-02-12".to_string(), 1, 1500));
    }

    #[test]
    fn weekly_summary_task_groups_span_week() {
        let conn = setup_test_db();
        insert_task(&conn, "Mon PROJ-1", "2026-02-10", "completed", Some("PROJ-1"), 0);
        insert_task(&conn, "Wed PROJ-1", "2026-02-12", "completed", Some("PROJ-1"), 0);
        insert_task(&conn, "Wed PROJ-2", "2026-02-12", "pending", Some("PROJ-2"), 1);
        insert_task(&conn, "No Jira", "2026-02-14", "completed", None, 0);

        let groups = query_task_groups(&conn, "2026-02-10", "2026-02-16").unwrap();
        assert_eq!(groups.len(), 3);
        assert_eq!(groups[0].jira_key, Some("PROJ-1".to_string()));
        assert_eq!(groups[0].tasks.len(), 2);
        assert_eq!(groups[1].jira_key, Some("PROJ-2".to_string()));
        assert_eq!(groups[1].tasks.len(), 1);
        assert_eq!(groups[2].jira_key, None);
        assert_eq!(groups[2].tasks.len(), 1);
    }

    #[test]
    fn daily_summary_subtasks_excluded_from_groups() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-15", "completed", Some("PROJ-1"), 0);
        insert_subtask(&conn, "Subtask", "2026-02-15", "completed", parent_id);

        let groups = query_task_groups(&conn, "2026-02-15", "2026-02-15").unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].tasks.len(), 1); // Only parent, not subtask
        assert_eq!(groups[0].tasks[0].title, "Parent");
    }

    #[test]
    fn weekly_summary_excludes_cancelled_intervals() {
        let conn = setup_test_db();
        insert_interval(&conn, "work", "2026-02-10T09:00:00Z", "2026-02-10T09:25:00Z", 1500, "completed");
        insert_interval(&conn, "work", "2026-02-10T10:00:00Z", "2026-02-10T10:25:00Z", 1500, "cancelled");

        let (pomo_count, focus_secs) = query_pomodoro_stats(&conn, "2026-02-10").unwrap();
        assert_eq!(pomo_count, 1);
        assert_eq!(focus_secs, 1500);
    }
}
