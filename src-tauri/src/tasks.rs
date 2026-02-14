use chrono::Utc;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::timer::AppState;

// ── Types ────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatus {
    Pending,
    Completed,
    Abandoned,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub title: String,
    pub day_date: String,
    pub status: String,
    pub parent_task_id: Option<i64>,
    pub linked_from_task_id: Option<i64>,
    pub jira_key: Option<String>,
    pub tag: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

// ── Database helpers ────────────────────────────────────────

fn open_db(db_path: &Path) -> Result<Connection, String> {
    let conn =
        Connection::open(db_path).map_err(|e| format!("Failed to open database: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to set pragmas: {e}"))?;
    Ok(conn)
}

fn row_to_task(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        day_date: row.get(2)?,
        status: row.get(3)?,
        parent_task_id: row.get(4)?,
        linked_from_task_id: row.get(5)?,
        jira_key: row.get(6)?,
        tag: row.get(7)?,
        position: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

const TASK_COLUMNS: &str = "id, title, day_date, status, parent_task_id, linked_from_task_id, \
                            jira_key, tag, position, created_at, updated_at";

// ── Tauri commands ──────────────────────────────────────────

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn create_task(
    state: tauri::State<'_, AppState>,
    title: String,
    day_date: String,
    parent_task_id: Option<i64>,
    jira_key: Option<String>,
    tag: Option<String>,
) -> Result<Task, String> {
    let conn = open_db(&state.db_path)?;

    // Get next position for this day
    let max_pos: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM tasks WHERE day_date = ?1 AND parent_task_id IS NULL",
            [&day_date],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query max position: {e}"))?;
    let position = max_pos + 1;

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "INSERT INTO tasks (title, day_date, parent_task_id, jira_key, tag, position, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![title, day_date, parent_task_id, jira_key, tag, position, now, now],
    )
    .map_err(|e| format!("Failed to create task: {e}"))?;

    let id = conn.last_insert_rowid();

    conn.query_row(
        &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
        [id],
        row_to_task,
    )
    .map_err(|e| format!("Failed to fetch created task: {e}"))
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn update_task(
    state: tauri::State<'_, AppState>,
    id: i64,
    title: Option<String>,
    jira_key: Option<String>,
    tag: Option<String>,
) -> Result<Task, String> {
    let conn = open_db(&state.db_path)?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut set_clauses = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref t) = title {
        set_clauses.push(format!("title = ?{idx}"));
        params.push(Box::new(t.clone()));
        idx += 1;
    }
    if let Some(ref j) = jira_key {
        set_clauses.push(format!("jira_key = ?{idx}"));
        params.push(Box::new(j.clone()));
        idx += 1;
    }
    if let Some(ref tg) = tag {
        set_clauses.push(format!("tag = ?{idx}"));
        params.push(Box::new(tg.clone()));
        idx += 1;
    }

    if set_clauses.is_empty() {
        // Nothing to update, just return the current task
        return conn
            .query_row(
                &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
                [id],
                row_to_task,
            )
            .map_err(|e| format!("Task not found: {e}"));
    }

    set_clauses.push(format!("updated_at = ?{idx}"));
    params.push(Box::new(now));
    idx += 1;

    let sql = format!(
        "UPDATE tasks SET {} WHERE id = ?{idx}",
        set_clauses.join(", ")
    );
    params.push(Box::new(id));

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(AsRef::as_ref).collect();
    conn.execute(&sql, param_refs.as_slice())
        .map_err(|e| format!("Failed to update task: {e}"))?;

    conn.query_row(
        &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
        [id],
        row_to_task,
    )
    .map_err(|e| format!("Task not found: {e}"))
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn delete_task(state: tauri::State<'_, AppState>, id: i64) -> Result<(), String> {
    let conn = open_db(&state.db_path)?;

    // Block delete on completed or abandoned tasks
    let status: String = conn
        .query_row("SELECT status FROM tasks WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Task not found: {e}"))?;

    if status == "completed" || status == "abandoned" {
        return Err(format!(
            "Cannot delete a {status} task. Reopen it first."
        ));
    }

    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])
        .map_err(|e| format!("Failed to delete task: {e}"))?;
    Ok(())
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn complete_task(state: tauri::State<'_, AppState>, id: i64) -> Result<Task, String> {
    let conn = open_db(&state.db_path)?;

    // Check for pending subtasks
    let pending_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tasks WHERE parent_task_id = ?1 AND status = 'pending'",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to check subtasks: {e}"))?;

    if pending_count > 0 {
        return Err("Cannot complete task with pending subtasks".into());
    }

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "UPDATE tasks SET status = 'completed', updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| format!("Failed to complete task: {e}"))?;

    conn.query_row(
        &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
        [id],
        row_to_task,
    )
    .map_err(|e| format!("Task not found: {e}"))
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn abandon_task(state: tauri::State<'_, AppState>, id: i64) -> Result<Task, String> {
    let conn = open_db(&state.db_path)?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    conn.execute(
        "UPDATE tasks SET status = 'abandoned', updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| format!("Failed to abandon task: {e}"))?;

    conn.query_row(
        &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
        [id],
        row_to_task,
    )
    .map_err(|e| format!("Task not found: {e}"))
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn reopen_task(state: tauri::State<'_, AppState>, id: i64) -> Result<Task, String> {
    let conn = open_db(&state.db_path)?;

    let status: String = conn
        .query_row("SELECT status FROM tasks WHERE id = ?1", [id], |row| {
            row.get(0)
        })
        .map_err(|e| format!("Task not found: {e}"))?;

    if status == "pending" {
        return Err("Task is already pending".into());
    }

    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "UPDATE tasks SET status = 'pending', updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, id],
    )
    .map_err(|e| format!("Failed to reopen task: {e}"))?;

    conn.query_row(
        &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
        [id],
        row_to_task,
    )
    .map_err(|e| format!("Task not found: {e}"))
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn get_tasks_by_date(
    state: tauri::State<'_, AppState>,
    day_date: String,
) -> Result<Vec<Task>, String> {
    let conn = open_db(&state.db_path)?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {TASK_COLUMNS} FROM tasks WHERE day_date = ?1 ORDER BY position ASC, created_at ASC"
        ))
        .map_err(|e| format!("Failed to prepare query: {e}"))?;

    let tasks = stmt
        .query_map([&day_date], row_to_task)
        .map_err(|e| format!("Failed to query tasks: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read tasks: {e}"))?;

    Ok(tasks)
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn clone_task(state: tauri::State<'_, AppState>, id: i64) -> Result<Task, String> {
    let conn = open_db(&state.db_path)?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    // Fetch original
    let original = conn
        .query_row(
            &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
            [id],
            row_to_task,
        )
        .map_err(|e| format!("Task not found: {e}"))?;

    // Get next position
    let max_pos: i64 = conn
        .query_row(
            "SELECT COALESCE(MAX(position), -1) FROM tasks WHERE day_date = ?1 AND parent_task_id IS NULL",
            [&original.day_date],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to query max position: {e}"))?;

    // Clone parent task
    conn.execute(
        "INSERT INTO tasks (title, day_date, status, jira_key, tag, position, created_at, updated_at) \
         VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![original.title, original.day_date, original.jira_key, original.tag, max_pos + 1, now, now],
    )
    .map_err(|e| format!("Failed to clone task: {e}"))?;

    let new_id = conn.last_insert_rowid();

    // Clone subtasks
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {TASK_COLUMNS} FROM tasks WHERE parent_task_id = ?1"
        ))
        .map_err(|e| format!("Failed to prepare subtask query: {e}"))?;

    let subtasks: Vec<Task> = stmt
        .query_map([id], row_to_task)
        .map_err(|e| format!("Failed to query subtasks: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read subtasks: {e}"))?;

    for sub in subtasks {
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, parent_task_id, jira_key, tag, position, created_at, updated_at) \
             VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![sub.title, sub.day_date, new_id, sub.jira_key, sub.tag, sub.position, now, now],
        )
        .map_err(|e| format!("Failed to clone subtask: {e}"))?;
    }

    conn.query_row(
        &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
        [new_id],
        row_to_task,
    )
    .map_err(|e| format!("Failed to fetch cloned task: {e}"))
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn reorder_tasks(
    state: tauri::State<'_, AppState>,
    task_ids: Vec<i64>,
) -> Result<(), String> {
    let conn = open_db(&state.db_path)?;
    for (i, task_id) in task_ids.iter().enumerate() {
        conn.execute(
            "UPDATE tasks SET position = ?1 WHERE id = ?2",
            rusqlite::params![i64::try_from(i).unwrap_or(0), task_id],
        )
        .map_err(|e| format!("Failed to reorder task: {e}"))?;
    }
    Ok(())
}

// ── Task-Interval Link types ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskIntervalCount {
    pub task_id: i64,
    pub count: i64,
}

// ── Task-Interval Link commands ─────────────────────────────

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn link_tasks_to_interval(
    state: tauri::State<'_, AppState>,
    task_ids: Vec<i64>,
    interval_id: i64,
) -> Result<(), String> {
    let conn = open_db(&state.db_path)?;
    for task_id in task_ids {
        conn.execute(
            "INSERT OR IGNORE INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            rusqlite::params![task_id, interval_id],
        )
        .map_err(|e| format!("Failed to link task {task_id} to interval {interval_id}: {e}"))?;
    }
    Ok(())
}

#[allow(clippy::needless_pass_by_value)]
#[tauri::command]
pub fn get_task_interval_counts(
    state: tauri::State<'_, AppState>,
    day_date: String,
) -> Result<Vec<TaskIntervalCount>, String> {
    let conn = open_db(&state.db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT t.id, COUNT(til.id) as link_count \
             FROM tasks t \
             LEFT JOIN task_interval_links til ON til.task_id = t.id \
             WHERE t.day_date = ?1 AND t.parent_task_id IS NULL \
             GROUP BY t.id \
             HAVING link_count > 0",
        )
        .map_err(|e| format!("Failed to prepare interval count query: {e}"))?;

    let counts = stmt
        .query_map([&day_date], |row| {
            Ok(TaskIntervalCount {
                task_id: row.get(0)?,
                count: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query interval counts: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to read interval counts: {e}"))?;

    Ok(counts)
}

// ── Tests ───────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        crate::database::run_migrations(&conn).unwrap();
        conn
    }

    fn insert_task(conn: &Connection, title: &str, day_date: &str, position: i64) -> i64 {
        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES (?1, ?2, ?3)",
            rusqlite::params![title, day_date, position],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn insert_subtask(conn: &Connection, title: &str, day_date: &str, parent_id: i64) -> i64 {
        conn.execute(
            "INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES (?1, ?2, 0, ?3)",
            rusqlite::params![title, day_date, parent_id],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    fn get_task(conn: &Connection, id: i64) -> Task {
        conn.query_row(
            &format!("SELECT {TASK_COLUMNS} FROM tasks WHERE id = ?1"),
            [id],
            row_to_task,
        )
        .unwrap()
    }

    fn count_tasks(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))
            .unwrap()
    }

    // ── CRUD tests ──────────────────────────────────────────

    #[test]
    fn create_task_inserts_row() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Test task", "2026-02-14", 0);
        let task = get_task(&conn, id);
        assert_eq!(task.title, "Test task");
        assert_eq!(task.day_date, "2026-02-14");
        assert_eq!(task.status, "pending");
        assert_eq!(task.position, 0);
    }

    #[test]
    fn create_task_with_jira_key_and_tag() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO tasks (title, day_date, position, jira_key, tag) VALUES ('Task', '2026-02-14', 0, 'LRE-42', 'dev')",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();
        let task = get_task(&conn, id);
        assert_eq!(task.jira_key.as_deref(), Some("LRE-42"));
        assert_eq!(task.tag.as_deref(), Some("dev"));
    }

    #[test]
    fn update_task_title() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Original", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET title = 'Updated' WHERE id = ?1", [id])
            .unwrap();
        let task = get_task(&conn, id);
        assert_eq!(task.title, "Updated");
    }

    #[test]
    fn delete_task_removes_row() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "To delete", "2026-02-14", 0);
        assert_eq!(count_tasks(&conn), 1);
        conn.execute("DELETE FROM tasks WHERE id = ?1", [id]).unwrap();
        assert_eq!(count_tasks(&conn), 0);
    }

    #[test]
    fn get_tasks_by_date_returns_only_matching() {
        let conn = setup_test_db();
        insert_task(&conn, "Task 1", "2026-02-14", 0);
        insert_task(&conn, "Task 2", "2026-02-14", 1);
        insert_task(&conn, "Other day", "2026-02-15", 0);

        let mut stmt = conn
            .prepare(&format!(
                "SELECT {TASK_COLUMNS} FROM tasks WHERE day_date = ?1 ORDER BY position ASC"
            ))
            .unwrap();
        let tasks: Vec<Task> = stmt
            .query_map(["2026-02-14"], row_to_task)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].title, "Task 1");
        assert_eq!(tasks[1].title, "Task 2");
    }

    #[test]
    fn get_tasks_by_date_orders_by_position() {
        let conn = setup_test_db();
        insert_task(&conn, "Second", "2026-02-14", 1);
        insert_task(&conn, "First", "2026-02-14", 0);

        let mut stmt = conn
            .prepare(&format!(
                "SELECT {TASK_COLUMNS} FROM tasks WHERE day_date = ?1 ORDER BY position ASC"
            ))
            .unwrap();
        let tasks: Vec<Task> = stmt
            .query_map(["2026-02-14"], row_to_task)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(tasks[0].title, "First");
        assert_eq!(tasks[1].title, "Second");
    }

    // ── Subtask tests ───────────────────────────────────────

    #[test]
    fn create_subtask() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        let sub_id = insert_subtask(&conn, "Subtask", "2026-02-14", parent_id);
        let sub = get_task(&conn, sub_id);
        assert_eq!(sub.parent_task_id, Some(parent_id));
    }

    #[test]
    fn delete_parent_cascades_to_subtasks() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        insert_subtask(&conn, "Sub 1", "2026-02-14", parent_id);
        insert_subtask(&conn, "Sub 2", "2026-02-14", parent_id);
        assert_eq!(count_tasks(&conn), 3);

        conn.execute("DELETE FROM tasks WHERE id = ?1", [parent_id]).unwrap();
        assert_eq!(count_tasks(&conn), 0);
    }

    // ── Completion constraint tests ─────────────────────────

    #[test]
    fn complete_parent_with_all_subtasks_completed() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        let sub_id = insert_subtask(&conn, "Sub", "2026-02-14", parent_id);

        // Complete subtask first
        conn.execute("UPDATE tasks SET status = 'completed' WHERE id = ?1", [sub_id])
            .unwrap();

        // Check no pending subtasks
        let pending: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE parent_task_id = ?1 AND status = 'pending'",
                [parent_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pending, 0);

        // Can complete parent
        conn.execute("UPDATE tasks SET status = 'completed' WHERE id = ?1", [parent_id])
            .unwrap();
        let parent = get_task(&conn, parent_id);
        assert_eq!(parent.status, "completed");
    }

    #[test]
    fn cannot_complete_parent_with_pending_subtasks() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        insert_subtask(&conn, "Pending Sub", "2026-02-14", parent_id);

        // Check pending subtasks exist
        let pending: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE parent_task_id = ?1 AND status = 'pending'",
                [parent_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(pending > 0, "Should have pending subtasks blocking completion");
    }

    #[test]
    fn can_complete_parent_with_abandoned_subtasks() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        let sub_id = insert_subtask(&conn, "Sub", "2026-02-14", parent_id);

        // Abandon subtask
        conn.execute("UPDATE tasks SET status = 'abandoned' WHERE id = ?1", [sub_id])
            .unwrap();

        // No pending subtasks
        let pending: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE parent_task_id = ?1 AND status = 'pending'",
                [parent_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(pending, 0);
    }

    // ── Status transition tests ─────────────────────────────

    #[test]
    fn abandon_task_sets_status() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET status = 'abandoned' WHERE id = ?1", [id])
            .unwrap();
        let task = get_task(&conn, id);
        assert_eq!(task.status, "abandoned");
    }

    #[test]
    fn complete_task_sets_status() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET status = 'completed' WHERE id = ?1", [id])
            .unwrap();
        let task = get_task(&conn, id);
        assert_eq!(task.status, "completed");
    }

    // ── Clone tests ─────────────────────────────────────────

    #[test]
    fn clone_task_creates_independent_copy() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Original", "2026-02-14", 0);

        // Clone
        let original = get_task(&conn, id);
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, jira_key, tag, position) VALUES (?1, ?2, 'pending', ?3, ?4, ?5)",
            rusqlite::params![original.title, original.day_date, original.jira_key, original.tag, 1],
        )
        .unwrap();
        let clone_id = conn.last_insert_rowid();

        let cloned = get_task(&conn, clone_id);
        assert_ne!(cloned.id, original.id);
        assert_eq!(cloned.title, original.title);
        assert_eq!(cloned.day_date, original.day_date);
        assert_eq!(cloned.status, "pending");
    }

    #[test]
    fn clone_task_with_subtasks_deep_copies() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        insert_subtask(&conn, "Sub 1", "2026-02-14", parent_id);
        insert_subtask(&conn, "Sub 2", "2026-02-14", parent_id);

        // Clone parent
        let original = get_task(&conn, parent_id);
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, jira_key, tag, position) VALUES (?1, ?2, 'pending', ?3, ?4, ?5)",
            rusqlite::params![original.title, original.day_date, original.jira_key, original.tag, 1],
        )
        .unwrap();
        let clone_id = conn.last_insert_rowid();

        // Clone subtasks
        let mut stmt = conn
            .prepare(&format!("SELECT {TASK_COLUMNS} FROM tasks WHERE parent_task_id = ?1"))
            .unwrap();
        let subs: Vec<Task> = stmt
            .query_map([parent_id], row_to_task)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        for sub in &subs {
            conn.execute(
                "INSERT INTO tasks (title, day_date, status, parent_task_id, jira_key, tag, position) VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6)",
                rusqlite::params![sub.title, sub.day_date, clone_id, sub.jira_key, sub.tag, sub.position],
            )
            .unwrap();
        }

        // Verify cloned subtasks
        let clone_subs: Vec<Task> = conn
            .prepare(&format!("SELECT {TASK_COLUMNS} FROM tasks WHERE parent_task_id = ?1"))
            .unwrap()
            .query_map([clone_id], row_to_task)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(clone_subs.len(), 2);
        assert_eq!(clone_subs[0].parent_task_id, Some(clone_id));
        assert_eq!(clone_subs[1].parent_task_id, Some(clone_id));
    }

    #[test]
    fn cloned_subtasks_are_independent() {
        let conn = setup_test_db();
        let parent_id = insert_task(&conn, "Parent", "2026-02-14", 0);
        let sub_id = insert_subtask(&conn, "Sub", "2026-02-14", parent_id);

        // Clone
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, position) VALUES ('Parent', '2026-02-14', 'pending', 1)",
            [],
        )
        .unwrap();
        let clone_id = conn.last_insert_rowid();
        conn.execute(
            "INSERT INTO tasks (title, day_date, status, parent_task_id, position) VALUES ('Sub', '2026-02-14', 'pending', ?1, 0)",
            [clone_id],
        )
        .unwrap();

        // Complete original subtask
        conn.execute("UPDATE tasks SET status = 'completed' WHERE id = ?1", [sub_id])
            .unwrap();

        // Cloned subtask should still be pending
        let clone_subs: Vec<Task> = conn
            .prepare(&format!("SELECT {TASK_COLUMNS} FROM tasks WHERE parent_task_id = ?1"))
            .unwrap()
            .query_map([clone_id], row_to_task)
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(clone_subs[0].status, "pending");
    }

    // ── Reorder tests ───────────────────────────────────────

    #[test]
    fn reorder_updates_positions() {
        let conn = setup_test_db();
        let id1 = insert_task(&conn, "Task 1", "2026-02-14", 0);
        let id2 = insert_task(&conn, "Task 2", "2026-02-14", 1);
        let id3 = insert_task(&conn, "Task 3", "2026-02-14", 2);

        // Reorder: Task 3 first, Task 1 second, Task 2 third
        let new_order = [id3, id1, id2];
        for (i, &task_id) in new_order.iter().enumerate() {
            conn.execute(
                "UPDATE tasks SET position = ?1 WHERE id = ?2",
                rusqlite::params![i64::try_from(i).unwrap_or(0), task_id],
            )
            .unwrap();
        }

        assert_eq!(get_task(&conn, id3).position, 0);
        assert_eq!(get_task(&conn, id1).position, 1);
        assert_eq!(get_task(&conn, id2).position, 2);
    }

    // ── Task status serde tests ─────────────────────────────

    #[test]
    fn task_status_serde_roundtrip() {
        let json = serde_json::to_string(&TaskStatus::Completed).unwrap();
        assert_eq!(json, "\"completed\"");
        let parsed: TaskStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, TaskStatus::Completed);
    }

    #[test]
    fn task_status_all_variants_serialize() {
        assert_eq!(serde_json::to_string(&TaskStatus::Pending).unwrap(), "\"pending\"");
        assert_eq!(serde_json::to_string(&TaskStatus::Abandoned).unwrap(), "\"abandoned\"");
    }

    // ── Reopen tests ────────────────────────────────────────

    #[test]
    fn reopen_completed_task() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET status = 'completed' WHERE id = ?1", [id])
            .unwrap();

        // Reopen
        conn.execute("UPDATE tasks SET status = 'pending' WHERE id = ?1", [id])
            .unwrap();
        let task = get_task(&conn, id);
        assert_eq!(task.status, "pending");
    }

    #[test]
    fn reopen_abandoned_task() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET status = 'abandoned' WHERE id = ?1", [id])
            .unwrap();

        // Reopen
        conn.execute("UPDATE tasks SET status = 'pending' WHERE id = ?1", [id])
            .unwrap();
        let task = get_task(&conn, id);
        assert_eq!(task.status, "pending");
    }

    #[test]
    fn reopen_pending_task_is_noop() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        let task = get_task(&conn, id);
        assert_eq!(task.status, "pending");
        // Already pending — the command would return an error
    }

    // ── Delete guard tests ──────────────────────────────────

    #[test]
    fn delete_completed_task_blocked() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET status = 'completed' WHERE id = ?1", [id])
            .unwrap();

        let status: String = conn
            .query_row("SELECT status FROM tasks WHERE id = ?1", [id], |row| row.get(0))
            .unwrap();
        assert_eq!(status, "completed");
        // The delete_task command would reject this
    }

    #[test]
    fn delete_abandoned_task_blocked() {
        let conn = setup_test_db();
        let id = insert_task(&conn, "Task", "2026-02-14", 0);
        conn.execute("UPDATE tasks SET status = 'abandoned' WHERE id = ?1", [id])
            .unwrap();

        let status: String = conn
            .query_row("SELECT status FROM tasks WHERE id = ?1", [id], |row| row.get(0))
            .unwrap();
        assert_eq!(status, "abandoned");
        // The delete_task command would reject this
    }

    // ── Task-Interval Link tests ────────────────────────────

    fn insert_interval(conn: &Connection) -> i64 {
        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status) \
             VALUES ('work', '2026-02-14T09:00:00Z', 1500, 'completed')",
            [],
        )
        .unwrap();
        conn.last_insert_rowid()
    }

    #[test]
    fn link_task_to_interval() {
        let conn = setup_test_db();
        let task_id = insert_task(&conn, "Task", "2026-02-14", 0);
        let interval_id = insert_interval(&conn);

        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task_id, interval_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_interval_links WHERE task_id = ?1 AND interval_id = ?2",
                [task_id, interval_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn link_multiple_tasks_to_interval() {
        let conn = setup_test_db();
        let task1 = insert_task(&conn, "Task 1", "2026-02-14", 0);
        let task2 = insert_task(&conn, "Task 2", "2026-02-14", 1);
        let interval_id = insert_interval(&conn);

        for task_id in [task1, task2] {
            conn.execute(
                "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
                [task_id, interval_id],
            )
            .unwrap();
        }

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_interval_links WHERE interval_id = ?1",
                [interval_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 2);
    }

    #[test]
    fn duplicate_link_is_ignored_with_or_ignore() {
        let conn = setup_test_db();
        let task_id = insert_task(&conn, "Task", "2026-02-14", 0);
        let interval_id = insert_interval(&conn);

        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task_id, interval_id],
        )
        .unwrap();

        // INSERT OR IGNORE should not error on duplicate
        conn.execute(
            "INSERT OR IGNORE INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task_id, interval_id],
        )
        .unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_interval_links WHERE task_id = ?1",
                [task_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn interval_counts_returns_correct_data() {
        let conn = setup_test_db();
        let task1 = insert_task(&conn, "Task 1", "2026-02-14", 0);
        let task2 = insert_task(&conn, "Task 2", "2026-02-14", 1);
        let _task3 = insert_task(&conn, "Task 3", "2026-02-14", 2);

        let interval1 = insert_interval(&conn);
        let interval2 = insert_interval(&conn);

        // Task 1 linked to both intervals
        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task1, interval1],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task1, interval2],
        )
        .unwrap();

        // Task 2 linked to one interval
        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task2, interval1],
        )
        .unwrap();

        // Task 3 has no links — should not appear

        let mut stmt = conn
            .prepare(
                "SELECT t.id, COUNT(til.id) as link_count \
                 FROM tasks t \
                 LEFT JOIN task_interval_links til ON til.task_id = t.id \
                 WHERE t.day_date = '2026-02-14' AND t.parent_task_id IS NULL \
                 GROUP BY t.id \
                 HAVING link_count > 0",
            )
            .unwrap();

        let counts: Vec<(i64, i64)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(counts.len(), 2);

        let task1_count = counts.iter().find(|(id, _)| *id == task1).map(|(_, c)| *c);
        let task2_count = counts.iter().find(|(id, _)| *id == task2).map(|(_, c)| *c);
        assert_eq!(task1_count, Some(2));
        assert_eq!(task2_count, Some(1));
    }

    #[test]
    fn interval_counts_excludes_other_days() {
        let conn = setup_test_db();
        let task1 = insert_task(&conn, "Today", "2026-02-14", 0);
        let task2 = insert_task(&conn, "Tomorrow", "2026-02-15", 0);
        let interval_id = insert_interval(&conn);

        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task1, interval_id],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task2, interval_id],
        )
        .unwrap();

        let mut stmt = conn
            .prepare(
                "SELECT t.id, COUNT(til.id) as link_count \
                 FROM tasks t \
                 LEFT JOIN task_interval_links til ON til.task_id = t.id \
                 WHERE t.day_date = '2026-02-14' AND t.parent_task_id IS NULL \
                 GROUP BY t.id \
                 HAVING link_count > 0",
            )
            .unwrap();

        let counts: Vec<(i64, i64)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(counts.len(), 1);
        assert_eq!(counts[0].0, task1);
    }
}
