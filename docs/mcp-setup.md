# MCP Server Setup for Pomo

> How to connect an AI agent (Claude, etc.) to Pomo's SQLite database using the Model Context Protocol (MCP).

---

## Overview

Pomo stores all data in a local SQLite database (`pomo.db`). You can give AI agents read-only access to this database using the [`mcp-server-sqlite-npx`](https://www.npmjs.com/package/mcp-server-sqlite-npx) MCP server.

This enables agents to answer questions like:
- "How many pomodoros did I complete today?"
- "What tasks did I work on this week?"
- "Show me my focus time trends for February"

## Finding Your Database Path

The database location is shown in **Settings** (gear icon) under "Database Location".

**Default path (Windows):**
```
%APPDATA%\com.pomo.app\pomo.db
```

Which typically resolves to:
```
C:\Users\<username>\AppData\Roaming\com.pomo.app\pomo.db
```

If you've configured a custom DB path, use that path instead.

## Setting Up the MCP Server

### 1. Configure Your AI Client

Add the following to your MCP client configuration (e.g., Claude Desktop's `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "pomo": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-sqlite-npx",
        "C:\\Users\\yance\\AppData\\Roaming\\com.pomo.app\\pomo.db"
      ]
    }
  }
}
```

> No separate install step is needed — `npx -y` downloads and runs the package automatically.

**Note for Claude Code on Windows:** Wrap the command in `cmd /c` since Claude Code uses a bash shell:
```json
{
  "mcpServers": {
    "pomo": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "mcp-server-sqlite-npx", "C:\\Users\\yance\\AppData\\Roaming\\com.pomo.app\\pomo.db"]
    }
  }
}
```

### 3. Verify the Connection

Ask your AI agent: "List all tables in the Pomo database." It should return:
- `user_settings`
- `timer_intervals`
- `tasks`
- `task_interval_links`

## Database Schema

### `user_settings`
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT (PK) | Setting name |
| value | TEXT | Setting value |
| type | TEXT | Value type (string, integer, real, boolean, json) |
| updated_at | TEXT | ISO 8601 timestamp |

### `timer_intervals`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| interval_type | TEXT | `work`, `short_break`, or `long_break` |
| start_time | TEXT | ISO 8601 start timestamp |
| end_time | TEXT | ISO 8601 end timestamp (null if in progress) |
| duration_seconds | INTEGER | Actual duration (null if in progress) |
| planned_duration_seconds | INTEGER | Planned duration |
| status | TEXT | `in_progress`, `completed`, or `cancelled` |
| created_at | TEXT | ISO 8601 timestamp |

### `tasks`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| title | TEXT | Task title |
| day_date | TEXT | Date the task belongs to (YYYY-MM-DD) |
| status | TEXT | `pending`, `completed`, or `abandoned` |
| parent_task_id | INTEGER | Parent task ID (null for top-level tasks) |
| linked_from_task_id | INTEGER | Original task ID if copied from another day |
| jira_key | TEXT | Jira ticket key (optional) |
| tag | TEXT | Tag label (optional) |
| position | INTEGER | Sort order within the day |
| completed_in_pomodoro | INTEGER | Which pomodoro number this task was completed in |
| created_at | TEXT | ISO 8601 timestamp |
| updated_at | TEXT | ISO 8601 timestamp |

### `task_interval_links`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER (PK) | Auto-increment ID |
| task_id | INTEGER | References tasks(id) |
| interval_id | INTEGER | References timer_intervals(id) |
| created_at | TEXT | ISO 8601 timestamp |

## Example Queries

### Today's completed pomodoros

```sql
SELECT COUNT(*) as pomodoro_count,
       SUM(duration_seconds) / 60 as total_minutes
FROM timer_intervals
WHERE interval_type = 'work'
  AND status = 'completed'
  AND date(start_time) = date('now');
```

### Tasks completed today

```sql
SELECT title, completed_in_pomodoro, tag, jira_key
FROM tasks
WHERE day_date = date('now')
  AND status = 'completed'
  AND parent_task_id IS NULL
ORDER BY completed_in_pomodoro;
```

### This week's daily focus summary

```sql
SELECT date(start_time) as day,
       COUNT(*) as pomodoros,
       SUM(duration_seconds) / 60 as focus_minutes
FROM timer_intervals
WHERE interval_type = 'work'
  AND status = 'completed'
  AND date(start_time) >= date('now', 'weekday 1', '-7 days')
GROUP BY date(start_time)
ORDER BY day;
```

### Tasks grouped by Jira ticket this week

```sql
SELECT COALESCE(jira_key, '(no ticket)') as ticket,
       COUNT(*) as task_count,
       GROUP_CONCAT(title, ', ') as tasks
FROM tasks
WHERE day_date >= date('now', 'weekday 1', '-7 days')
  AND status = 'completed'
  AND parent_task_id IS NULL
GROUP BY jira_key
ORDER BY task_count DESC;
```

### Monthly pomodoro trend

```sql
SELECT date(start_time) as day,
       COUNT(*) as pomodoros
FROM timer_intervals
WHERE interval_type = 'work'
  AND status = 'completed'
  AND strftime('%Y-%m', start_time) = strftime('%Y-%m', 'now')
GROUP BY date(start_time)
ORDER BY day;
```

### Timeline of today's intervals

```sql
SELECT interval_type,
       time(start_time) as started,
       time(end_time) as ended,
       duration_seconds / 60 as minutes
FROM timer_intervals
WHERE date(start_time) = date('now')
  AND status = 'completed'
ORDER BY start_time;
```

## Concurrent Access & WAL Mode

Pomo uses SQLite's **WAL (Write-Ahead Logging)** journal mode for local databases. WAL mode allows:

- **Concurrent readers**: Multiple processes can read the database simultaneously without blocking each other.
- **Non-blocking reads during writes**: The MCP server can read while Pomo is writing new intervals or tasks.

This means the MCP server can safely query Pomo's database while the app is running. No configuration changes are needed.

**Note for cloud-synced paths:** If your database is in a cloud-synced directory (OneDrive, Dropbox, Google Drive, iCloud), Pomo automatically switches to `journal_mode=DELETE` for safety. This still allows concurrent reads but with slightly different locking behavior. The MCP server will work correctly in both modes.

## Troubleshooting

### "Database is locked" errors
This should be rare with WAL mode. If it happens:
1. Ensure only one instance of Pomo is running
2. Close and reopen the MCP server connection
3. Check that no other process has an exclusive lock on the database

### MCP server can't find the database
1. Open Pomo's Settings to confirm the database path
2. Verify the file exists at that path
3. Update your MCP server configuration with the correct path

### Database is empty or has no tables
The database is only created after Pomo launches for the first time. Start Pomo at least once before configuring the MCP server.
