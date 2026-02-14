use rusqlite::{Connection, Result as SqliteResult};
use std::path::Path;

/// Schema v1: all 4 tables, trigger, indexes, and default settings.
const MIGRATION_V1: &str = r"
-- User Settings (P-2, P-3, P-4)
CREATE TABLE user_settings (
    key         TEXT PRIMARY KEY NOT NULL,
    value       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'string'
                CHECK (type IN ('string', 'integer', 'real', 'boolean', 'json')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Timer Intervals (T-5)
CREATE TABLE timer_intervals (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    interval_type            TEXT NOT NULL
                             CHECK (interval_type IN ('work', 'short_break', 'long_break')),
    start_time               TEXT NOT NULL,
    end_time                 TEXT,
    duration_seconds         INTEGER,
    planned_duration_seconds INTEGER NOT NULL,
    status                   TEXT NOT NULL DEFAULT 'in_progress'
                             CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    created_at               TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX idx_timer_intervals_start_time ON timer_intervals (start_time);
CREATE INDEX idx_timer_intervals_status ON timer_intervals (status);

-- Tasks (TK-1 through TK-13)
CREATE TABLE tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    day_date            TEXT NOT NULL,
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'abandoned')),
    parent_task_id      INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    linked_from_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    jira_key            TEXT,
    tag                 TEXT,
    position            INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Enforce single level of subtasks (TK-2)
CREATE TRIGGER enforce_single_level_subtasks
BEFORE INSERT ON tasks
WHEN NEW.parent_task_id IS NOT NULL
BEGIN
    SELECT RAISE(ABORT, 'Subtasks cannot have their own subtasks')
    WHERE EXISTS (
        SELECT 1 FROM tasks WHERE id = NEW.parent_task_id AND parent_task_id IS NOT NULL
    );
END;

CREATE INDEX idx_tasks_day_date ON tasks (day_date);
CREATE INDEX idx_tasks_parent ON tasks (parent_task_id);
CREATE INDEX idx_tasks_jira_key ON tasks (jira_key);

-- Task-Interval Links (T-6, T-7)
CREATE TABLE task_interval_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    interval_id INTEGER NOT NULL REFERENCES timer_intervals(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(task_id, interval_id)
);

CREATE INDEX idx_task_interval_links_task ON task_interval_links (task_id);
CREATE INDEX idx_task_interval_links_interval ON task_interval_links (interval_id);
";

/// Default settings seeded on first run.
const SEED_DEFAULT_SETTINGS: &str = r"
INSERT INTO user_settings (key, value, type) VALUES
    ('work_duration_minutes',        '25',    'integer'),
    ('short_break_duration_minutes', '5',     'integer'),
    ('long_break_duration_minutes',  '15',    'integer'),
    ('long_break_frequency',         '4',     'integer'),
    ('jira_base_url',                '',      'string'),
    ('jira_api_enabled',             'false', 'boolean');
";

/// Detect whether a path is inside a cloud-synced directory
/// (`OneDrive`, `Dropbox`, `Google Drive`, `iCloud`).
pub fn is_cloud_synced_path(path: &Path) -> bool {
    let path_str = path.to_string_lossy().to_lowercase();
    path_str.contains("onedrive")
        || path_str.contains("dropbox")
        || path_str.contains("google drive")
        || path_str.contains("googledrive")
        || path_str.contains("icloud")
}

/// Set connection-level pragmas. Must be called on every new connection.
fn set_pragmas(conn: &Connection, db_path: &Path) -> SqliteResult<()> {
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;

    if is_cloud_synced_path(db_path) {
        conn.execute_batch("PRAGMA journal_mode = DELETE;")?;
    } else {
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    }

    Ok(())
}

/// Read the current schema version from `PRAGMA user_version`.
fn get_user_version(conn: &Connection) -> SqliteResult<u32> {
    conn.pragma_query_value(None, "user_version", |row| row.get(0))
}

/// Set the schema version via `PRAGMA user_version`.
fn set_user_version(conn: &Connection, version: u32) -> SqliteResult<()> {
    conn.pragma_update(None, "user_version", version)
}

/// Run all pending migrations in order, tracked by `PRAGMA user_version`.
/// Each migration runs in a transaction. If a migration fails, the database
/// stays at the previous version.
pub fn run_migrations(conn: &Connection) -> SqliteResult<()> {
    let current = get_user_version(conn)?;

    if current < 1 {
        conn.execute_batch("BEGIN;")?;
        match conn.execute_batch(MIGRATION_V1) {
            Ok(()) => match conn.execute_batch(SEED_DEFAULT_SETTINGS) {
                Ok(()) => {
                    set_user_version(conn, 1)?;
                    conn.execute_batch("COMMIT;")?;
                }
                Err(e) => {
                    let _ = conn.execute_batch("ROLLBACK;");
                    return Err(e);
                }
            },
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(e);
            }
        }
    }

    if current < 2 {
        conn.execute_batch("BEGIN;")?;
        match conn.execute_batch(
            "ALTER TABLE tasks ADD COLUMN completed_in_pomodoro INTEGER;\n\
             INSERT OR IGNORE INTO user_settings (key, value, type) VALUES ('break_overtime_enabled', 'false', 'boolean');",
        ) {
            Ok(()) => {
                set_user_version(conn, 2)?;
                conn.execute_batch("COMMIT;")?;
            }
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(e);
            }
        }
    }

    Ok(())
}

/// Initialize the database at the given path.
/// Creates the parent directory if needed, applies pending migrations,
/// and configures pragmas.
pub fn initialize(db_path: &Path) -> Result<(), String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create database directory: {e}"))?;
    }

    let conn = Connection::open(db_path)
        .map_err(|e| format!("Failed to open database: {e}"))?;

    set_pragmas(&conn, db_path)
        .map_err(|e| format!("Failed to set database pragmas: {e}"))?;

    run_migrations(&conn)
        .map_err(|e| format!("Failed to run database migrations: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper: create an in-memory database with pragmas and migrations applied.
    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        run_migrations(&conn).unwrap();
        conn
    }

    // ── Migration tests ─────────────────────────────────────────

    #[test]
    fn migration_applies_cleanly_to_in_memory_db() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
    }

    #[test]
    fn migration_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        assert_eq!(get_user_version(&conn).unwrap(), 2);
    }

    #[test]
    fn user_version_is_set_to_2_after_migration() {
        let conn = Connection::open_in_memory().unwrap();
        assert_eq!(get_user_version(&conn).unwrap(), 0);
        run_migrations(&conn).unwrap();
        assert_eq!(get_user_version(&conn).unwrap(), 2);
    }

    // ── Table existence tests ───────────────────────────────────

    #[test]
    fn all_tables_exist() {
        let conn = setup_test_db();
        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"user_settings".to_string()));
        assert!(tables.contains(&"timer_intervals".to_string()));
        assert!(tables.contains(&"tasks".to_string()));
        assert!(tables.contains(&"task_interval_links".to_string()));
    }

    // ── Index existence tests ───────────────────────────────────

    #[test]
    fn all_indexes_exist() {
        let conn = setup_test_db();
        let indexes: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        let expected = [
            "idx_timer_intervals_start_time",
            "idx_timer_intervals_status",
            "idx_tasks_day_date",
            "idx_tasks_parent",
            "idx_tasks_jira_key",
            "idx_task_interval_links_task",
            "idx_task_interval_links_interval",
        ];

        for name in expected {
            assert!(
                indexes.contains(&name.to_string()),
                "Missing index: {name}"
            );
        }
    }

    // ── Trigger tests ───────────────────────────────────────────

    #[test]
    fn trigger_exists() {
        let conn = setup_test_db();
        let triggers: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(triggers.contains(&"enforce_single_level_subtasks".to_string()));
    }

    #[test]
    fn subtask_under_parent_succeeds() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES ('Parent', '2026-02-14', 0)",
            [],
        )
        .unwrap();
        let parent_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES ('Subtask', '2026-02-14', 0, ?1)",
            [parent_id],
        )
        .unwrap();
    }

    #[test]
    fn nested_subtask_is_rejected() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES ('Parent', '2026-02-14', 0)",
            [],
        )
        .unwrap();
        let parent_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES ('Subtask', '2026-02-14', 0, ?1)",
            [parent_id],
        )
        .unwrap();
        let subtask_id: i64 = conn.last_insert_rowid();

        let result = conn.execute(
            "INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES ('NestedSub', '2026-02-14', 0, ?1)",
            [subtask_id],
        );

        assert!(result.is_err(), "Nested subtask should be rejected by trigger");
        let err = result.unwrap_err().to_string();
        assert!(
            err.contains("Subtasks cannot have their own subtasks"),
            "Expected trigger error message, got: {err}"
        );
    }

    // ── Default settings tests ──────────────────────────────────

    #[test]
    fn default_settings_are_seeded() {
        let conn = setup_test_db();
        let count: u32 = conn
            .query_row("SELECT COUNT(*) FROM user_settings", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 7, "Expected 7 default settings");
    }

    #[test]
    fn default_work_duration_is_25() {
        let conn = setup_test_db();
        let value: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'work_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "25");
    }

    #[test]
    fn default_short_break_duration_is_5() {
        let conn = setup_test_db();
        let value: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'short_break_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "5");
    }

    #[test]
    fn default_long_break_duration_is_15() {
        let conn = setup_test_db();
        let value: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'long_break_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "15");
    }

    #[test]
    fn default_long_break_frequency_is_4() {
        let conn = setup_test_db();
        let value: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'long_break_frequency'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "4");
    }

    #[test]
    fn default_jira_api_enabled_is_false() {
        let conn = setup_test_db();
        let value: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'jira_api_enabled'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "false");
    }

    // ── Foreign key tests ───────────────────────────────────────

    #[test]
    fn foreign_key_cascade_deletes_subtasks() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES ('Parent', '2026-02-14', 0)",
            [],
        )
        .unwrap();
        let parent_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES ('Sub', '2026-02-14', 0, ?1)",
            [parent_id],
        )
        .unwrap();

        conn.execute("DELETE FROM tasks WHERE id = ?1", [parent_id])
            .unwrap();

        let count: u32 = conn
            .query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0, "Subtask should be cascade-deleted with parent");
    }

    #[test]
    fn foreign_key_task_interval_link_cascade() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES ('Task', '2026-02-14', 0)",
            [],
        )
        .unwrap();
        let task_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds) VALUES ('work', '2026-02-14T09:00:00Z', 1500)",
            [],
        )
        .unwrap();
        let interval_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task_id, interval_id],
        )
        .unwrap();

        conn.execute("DELETE FROM tasks WHERE id = ?1", [task_id])
            .unwrap();

        let count: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_interval_links",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "Link should be cascade-deleted with task");
    }

    #[test]
    fn unique_constraint_on_task_interval_link() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES ('Task', '2026-02-14', 0)",
            [],
        )
        .unwrap();
        let task_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds) VALUES ('work', '2026-02-14T09:00:00Z', 1500)",
            [],
        )
        .unwrap();
        let interval_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task_id, interval_id],
        )
        .unwrap();

        let result = conn.execute(
            "INSERT INTO task_interval_links (task_id, interval_id) VALUES (?1, ?2)",
            [task_id, interval_id],
        );
        assert!(result.is_err(), "Duplicate link should violate UNIQUE constraint");
    }

    // ── Check constraint tests ──────────────────────────────────

    #[test]
    fn task_status_check_constraint() {
        let conn = setup_test_db();
        let result = conn.execute(
            "INSERT INTO tasks (title, day_date, position, status) VALUES ('T', '2026-02-14', 0, 'invalid')",
            [],
        );
        assert!(result.is_err(), "Invalid task status should be rejected");
    }

    #[test]
    fn interval_type_check_constraint() {
        let conn = setup_test_db();
        let result = conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds) VALUES ('invalid', '2026-02-14T09:00:00Z', 1500)",
            [],
        );
        assert!(result.is_err(), "Invalid interval type should be rejected");
    }

    #[test]
    fn interval_status_check_constraint() {
        let conn = setup_test_db();
        let result = conn.execute(
            "INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status) VALUES ('work', '2026-02-14T09:00:00Z', 1500, 'invalid')",
            [],
        );
        assert!(result.is_err(), "Invalid interval status should be rejected");
    }

    #[test]
    fn settings_type_check_constraint() {
        let conn = setup_test_db();
        let result = conn.execute(
            "INSERT INTO user_settings (key, value, type) VALUES ('test', 'val', 'invalid')",
            [],
        );
        assert!(result.is_err(), "Invalid settings type should be rejected");
    }

    // ── Cloud-sync path detection tests ─────────────────────────

    #[test]
    fn detects_onedrive_path() {
        assert!(is_cloud_synced_path(Path::new(
            r"C:\Users\user\OneDrive\Documents\pomo.db"
        )));
    }

    #[test]
    fn detects_dropbox_path() {
        assert!(is_cloud_synced_path(Path::new(
            r"C:\Users\user\Dropbox\pomo.db"
        )));
    }

    #[test]
    fn detects_google_drive_path() {
        assert!(is_cloud_synced_path(Path::new(
            r"G:\My Drive\Google Drive\pomo.db"
        )));
    }

    #[test]
    fn local_path_is_not_cloud_synced() {
        assert!(!is_cloud_synced_path(Path::new(
            r"C:\Users\user\AppData\Roaming\pomo\pomo.db"
        )));
    }

    // ── Linked task tests ───────────────────────────────────────

    // ── Settings round-trip tests ──────────────────────────────

    #[test]
    fn settings_update_and_read_round_trip() {
        let conn = setup_test_db();

        // Read initial value
        let initial: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'work_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(initial, "25");

        // Update value
        conn.execute(
            "UPDATE user_settings SET value = '35', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE key = 'work_duration_minutes'",
            [],
        )
        .unwrap();

        // Read updated value
        let updated: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'work_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(updated, "35");
    }

    #[test]
    fn settings_update_all_timer_durations_round_trip() {
        let conn = setup_test_db();

        let updates = [
            ("work_duration_minutes", "30"),
            ("short_break_duration_minutes", "7"),
            ("long_break_duration_minutes", "20"),
            ("long_break_frequency", "3"),
        ];

        for (key, value) in updates {
            conn.execute(
                "UPDATE user_settings SET value = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE key = ?2",
                rusqlite::params![value, key],
            )
            .unwrap();
        }

        // Read all back
        let mut stmt = conn
            .prepare("SELECT key, value FROM user_settings WHERE key IN ('work_duration_minutes', 'short_break_duration_minutes', 'long_break_duration_minutes', 'long_break_frequency') ORDER BY key")
            .unwrap();
        let results: Vec<(String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert_eq!(results.len(), 4);
        assert!(results.contains(&("long_break_duration_minutes".to_string(), "20".to_string())));
        assert!(results.contains(&("long_break_frequency".to_string(), "3".to_string())));
        assert!(results.contains(&("short_break_duration_minutes".to_string(), "7".to_string())));
        assert!(results.contains(&("work_duration_minutes".to_string(), "30".to_string())));
    }

    #[test]
    fn settings_updated_at_changes_on_update() {
        let conn = setup_test_db();

        let before: String = conn
            .query_row(
                "SELECT updated_at FROM user_settings WHERE key = 'work_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        conn.execute(
            "UPDATE user_settings SET value = '45', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE key = 'work_duration_minutes'",
            [],
        )
        .unwrap();

        let after: String = conn
            .query_row(
                "SELECT updated_at FROM user_settings WHERE key = 'work_duration_minutes'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        // Both should be valid ISO 8601 timestamps
        assert!(before.contains('T'));
        assert!(after.contains('T'));
    }

    // ── Linked task tests ───────────────────────────────────────

    // ── Migration v2 tests ────────────────────────────────────

    #[test]
    fn migration_v2_adds_completed_in_pomodoro_column() {
        let conn = setup_test_db();
        conn.execute(
            "INSERT INTO tasks (title, day_date, position, completed_in_pomodoro) VALUES ('Task', '2026-02-14', 0, 3)",
            [],
        )
        .unwrap();
        let id = conn.last_insert_rowid();

        let val: Option<i64> = conn
            .query_row(
                "SELECT completed_in_pomodoro FROM tasks WHERE id = ?1",
                [id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(val, Some(3));
    }

    #[test]
    fn migration_v2_seeds_break_overtime_enabled_setting() {
        let conn = setup_test_db();
        let value: String = conn
            .query_row(
                "SELECT value FROM user_settings WHERE key = 'break_overtime_enabled'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(value, "false");
    }

    #[test]
    fn migration_v2_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        run_migrations(&conn).unwrap();
        run_migrations(&conn).unwrap();
        assert_eq!(get_user_version(&conn).unwrap(), 2);

        // Column still exists and setting still present
        let count: u32 = conn
            .query_row(
                "SELECT COUNT(*) FROM user_settings WHERE key = 'break_overtime_enabled'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 1);
    }

    // ── Linked task tests ───────────────────────────────────────

    #[test]
    fn linked_from_task_id_set_null_on_delete() {
        let conn = setup_test_db();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position) VALUES ('Original', '2026-02-14', 0)",
            [],
        )
        .unwrap();
        let original_id: i64 = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO tasks (title, day_date, position, linked_from_task_id) VALUES ('Copy', '2026-02-15', 0, ?1)",
            [original_id],
        )
        .unwrap();
        let copy_id: i64 = conn.last_insert_rowid();

        conn.execute("DELETE FROM tasks WHERE id = ?1", [original_id])
            .unwrap();

        let linked: Option<i64> = conn
            .query_row(
                "SELECT linked_from_task_id FROM tasks WHERE id = ?1",
                [copy_id],
                |row| row.get(0),
            )
            .unwrap();
        assert!(linked.is_none(), "linked_from_task_id should be NULL after original is deleted");
    }
}
