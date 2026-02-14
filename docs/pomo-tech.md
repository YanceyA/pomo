# Pomo - Technical Architecture Decisions

> This document presents the technical choices for the Pomo application. Each section identifies options, trade-offs, and a recommendation. Decisions marked **[PENDING]** require discussion before implementation begins.

---

## Decision 1: Desktop Application Shell — **Tauri v2**

The shell wraps the web-based UI into a native desktop window with system-level capabilities (file access, SQLite, audio, credentials).

### Options Evaluated

| | Tauri v2 | Electron |
|---|---|---|
| **Installer size** | 5-15 MB | 85-120 MB |
| **RAM at idle** | 30-80 MB | 150-200 MB |
| **Architecture** | Rust backend + OS webview (WebView2 on Win) | Chromium + Node.js |
| **SQLite** | `tauri-plugin-sql` (rusqlite) or custom Rust commands | `better-sqlite3` (gold standard) |
| **Audio** | Web Audio API + `rodio` (Rust) fallback | Web Audio API (full Chromium) |
| **Credential storage** | `keyring` crate (OS keychain) | `safeStorage` API (OS encryption) |
| **Timer in background** | Rust Tokio task (never throttled) | Main process `setInterval` (never throttled) |
| **Ecosystem maturity** | Stable since Oct 2024, growing rapidly | Stable since 2013, massive ecosystem |
| **Dev experience** | Vite HMR for frontend; Rust compilation adds 10-30s incremental builds | Vite HMR; Chrome DevTools; faster iteration |
| **Rust knowledge needed** | Yes - for backend commands, plugins, data layer | No - pure TypeScript/JavaScript |
| **Packaging** | NSIS/MSI via `cargo tauri build` | NSIS/MSI via `electron-builder` |
| **Auto-update** | `tauri-plugin-updater` (signed manifests) | `electron-updater` (GitHub Releases) |

### Eliminated Options

| Option | Reason for elimination |
|---|---|
| **Web-based (local server)** | Browser tab throttling breaks timers after ~1 min in background. Alarm may not fire after 25 min of inactivity. No native window behavior. Packaging is awkward. |
| **.NET WPF/MAUI** | Windows-only lock-in. XAML/MVVM learning curve. Web technologies (HTML/CSS) offer more flexibility for custom timeline visualizations. |

### Recommendation: **Tauri v2**

- 10-30x smaller installer and 3-5x less memory for an app that runs all day alongside IDE and browser.
- Rust backend gives reliable timer execution, native audio fallback, and secure credential storage.
- WebView2 is pre-installed on Windows 10/11 (Chromium-based, so CSS/JS compatibility is excellent).
- The trade-off is Rust: you need a Rust toolchain, and backend changes have slower compilation. For Pomo's data layer, `tauri-plugin-sql` covers most needs with occasional custom Rust commands for complex queries.
- If Rust becomes a blocker during development, migrating to Electron is feasible since the entire frontend (React/Svelte/Vue) transfers unchanged — only the IPC layer changes.

---

## Decision 2: Frontend Framework — **React 19**

The UI framework runs inside the desktop shell's webview.

### Options Evaluated

| | React 19 | Svelte 5 | Vue 3 |
|---|---|---|---|
| **Component ecosystem** | Largest (shadcn/ui, Mantine, MUI, Radix) | Growing (shadcn-svelte, Skeleton) | Strong (PrimeVue, Vuetify, Naive UI) |
| **DnD for nested tasks** | @dnd-kit (excellent, ~2-3M downloads/wk) | svelte-dnd-action (good, ~40-50K/wk) | vue-draggable-plus/SortableJS (good, ~50-80K/wk) |
| **Charting/timeline** | Chart.js, Recharts, visx, nivo | Chart.js (thinner wrappers), LayerCake | ECharts (richest), Chart.js |
| **State management** | Zustand (~1KB) or Jotai | Built-in runes (no library needed) | Pinia (official, ~2KB) |
| **TypeScript** | Best-in-class | Good (improved in v5) | Excellent |
| **Bundle size (typical app)** | ~190-240KB gzipped | ~110-140KB gzipped | ~200-270KB gzipped |
| **Community size** | ~25M downloads/wk | ~800K-1M/wk | ~4-5M/wk |
| **AI coding assistance** | Deepest training data | Moderate | Good |
| **Learning curve** | Moderate (hooks nuances) | Lowest (closest to vanilla HTML/JS) | Moderate (Composition API) |

### Eliminated Option

| Option | Reason |
|---|---|
| **SolidJS** | Ecosystem gaps are too significant. Drag-and-drop library (`solid-dnd`) has minimal nested container support and ~5-10K downloads/wk. No mature styled component library. Charting options limited. Technical elegance doesn't compensate for library risk on a production app. |

### Recommendation: **React 19**

- No capability gaps — every UI requirement maps to a mature, well-tested library.
- @dnd-kit handles the nested task/subtask drag-and-drop (the riskiest UI interaction) with proven patterns.
- Chart.js time-scale axis directly supports the daily timeline visualization.
- Zustand provides clean timer state management without React Context re-render issues.
- AI-assisted development velocity is highest with React (deepest training data for Claude, Copilot, etc.).
- Lowest risk: if any individual library becomes unmaintained, the React ecosystem has alternatives.

### Strong Alternative: **Vue 3**

Choose Vue instead if:
- You already have Vue experience and would be learning React from scratch.
- You want ECharts (via vue-echarts) for the richest reporting visualizations including calendar heatmaps.
- PrimeVue's built-in OrderList DnD could reduce library dependencies.
- Naive UI's default aesthetic is the closest to "calm and focused" without customization.

### Viable Alternative: **Svelte 5**

Choose Svelte instead if:
- You strongly prefer the simplest possible code (runes are genuinely elegant for timer state).
- Minimizing bundle size matters (40-50% smaller than React).
- You accept writing more custom code due to a thinner component ecosystem.

---

## Decision 3: UI Component Library — **shadcn/ui**

Depends on the frontend framework chosen above.

### If React:

| | shadcn/ui | Mantine v7 |
|---|---|---|
| **Model** | Copy-paste components (you own the code) | npm dependency |
| **Styling** | Radix primitives + Tailwind CSS | Custom CSS engine (not Emotion in v7) |
| **Date picker** | Needs `react-day-picker` separately | Built-in |
| **Form hooks** | Needs `react-hook-form` separately | Built-in `useForm` |
| **Aesthetic** | Clean, minimal, neutral — excellent for focus app | Clean, modern, slight "material-lite" feel |
| **Bundle** | ~10-20KB (your code, tree-shakes naturally) | ~30-60KB (tree-shaken) |
| **Customization** | Maximum (you own every file) | Theme variables + CSS overrides |

**Recommendation: shadcn/ui** — maximum aesthetic control, lightweight, aligns with calm/focused design. Pair with react-day-picker for dates and react-hook-form + Zod for forms.

### If Vue:

| | Naive UI | PrimeVue |
|---|---|---|
| **Default aesthetic** | Closest to "calm and focused" of any library | Clean with themes (Lara, Aura) |
| **Built-in DnD** | No | Yes (OrderList uses SortableJS) |
| **Calendar/timeline** | DatePicker, Calendar | DatePicker, Calendar, Timeline |
| **Docs quality** | Some Chinese-first pages | Comprehensive, English-first |

**Recommendation: PrimeVue** if you want maximum built-in capability; **Naive UI** if aesthetics are the priority.

### If Svelte:

**Recommendation: shadcn-svelte** — mirrors the React shadcn/ui experience, includes a Calendar component, built on Bits UI/Melt UI primitives + Tailwind CSS.

---

## Decision 4: Drag-and-Drop Library

Determined by frontend framework choice.

| Framework | Library | Nested Container Support | Maturity |
|---|---|---|---|
| React | @dnd-kit/core + @dnd-kit/sortable | Excellent (well-documented) | High (~2-3M dls/wk) |
| Vue | vue-draggable-plus (wraps SortableJS) | Good (SortableJS nested groups) | High (SortableJS battle-tested) |
| Svelte | svelte-dnd-action | Good (nested dndzone) | Medium (~40-50K dls/wk, single maintainer) |

All three handle Pomo's requirements: flat vertical task stack (TK-3) with one level of subtask nesting (TK-2).

---

## Decision 5: Charting / Timeline Library

For the reporting views (R-1 through R-7), two visualization types are needed:

1. **Daily timeline (R-4):** Horizontal bar/gantt showing pomodoro blocks positioned on a time axis.
2. **Summary charts (R-1, R-3, R-5, R-6):** Bar charts for pomodoro counts, grouped by Jira ticket.

| Library | Timeline Support | Summary Charts | Bundle (gzip) | Best With |
|---|---|---|---|---|
| **Chart.js + wrapper** | Good (time-scale floating bars) | Excellent | ~75-80KB | React, Svelte, Vue |
| **Recharts** | Weak (manual time-axis work) | Excellent | ~45KB | React only |
| **ECharts + vue-echarts** | Excellent (native time-axis, calendar heatmap) | Excellent | ~100-150KB | Vue |

**Recommendation: Chart.js** — handles both the daily timeline (via time-scale floating bars) and summary charts with the least custom work. Framework wrappers exist for all three frameworks (react-chartjs-2, svelte-chartjs, vue-chartjs).

**Alternative if Vue is chosen:** ECharts via vue-echarts for richer visualizations including calendar heatmaps for the monthly view (R-6).

---

## Decision 6: Database Engine — **SQLite (Confirmed)**

SQLite is the clear winner for this use case. No alternatives are competitive.

| Alternative | Why eliminated |
|---|---|
| JSON files | No query capability, no relational integrity, poor AI parsability |
| PouchDB/IndexedDB | Document-oriented (wrong for relational data), not file-based, no standard MCP access |
| DuckDB | OLAP-oriented (wrong for CRUD workloads), less mature bindings, no Tauri plugin |

### SQLite Binding (depends on shell choice)

| Shell | Binding | Notes |
|---|---|---|
| **Tauri v2** | `tauri-plugin-sql` or custom Rust commands via `rusqlite` | Native Rust performance, clean Tauri integration |
| **Electron** | `better-sqlite3` | Best performance, synchronous API, mature ecosystem |

### Cloud-Sync Safety (D-3)

SQLite WAL mode creates auxiliary files (`-wal`, `-shm`) that cloud sync services (OneDrive, Dropbox) may sync independently, risking corruption.

**Solution:**
- **Local path:** Use WAL mode for best write performance. Run `PRAGMA wal_checkpoint(TRUNCATE)` on app close to flush to single file.
- **Cloud-synced path:** Use `journal_mode=DELETE` (rollback journal) — only one file exists at rest. The app can detect the path type or offer a user toggle.

### Data Volumes (for context)

| Table | Estimated rows/year | 5-year total |
|---|---|---|
| timer_intervals | ~2,000 | ~10,000 |
| tasks | ~2,500 | ~12,500 |
| task_interval_links | ~3,000 | ~15,000 |
| user_settings | ~20-50 | ~50 |

This is trivially small for SQLite. Performance is never a concern.

---

## Decision 7: ORM / Query Layer — **Raw SQL + Typed Wrappers**

| Option | Type Safety | Weight | Migration Support | Tauri Fit | Electron Fit |
|---|---|---|---|---|---|
| **Drizzle ORM** | Excellent (schema-driven inference) | Light (~15KB) | Drizzle Kit generates SQL | Poor (no driver for tauri-plugin-sql) | Excellent (with better-sqlite3) |
| **Kysely** | Excellent (manual type interfaces) | Light (~10KB) | Built-in migration framework | Poor (no driver for tauri-plugin-sql) | Good |
| **Prisma** | Excellent (generated client) | **Heavy** (15-30MB query engine binary) | Prisma Migrate | Poor | Acceptable but bloated |
| **Raw SQL + typed wrappers** | Manual (you define result types) | Zero | Custom (see Decision 8) | **Best** (natural fit for tauri-plugin-sql) | Good |

### Recommendation

- **If Tauri:** Raw SQL with a typed TypeScript repository layer wrapping `tauri-plugin-sql`'s `execute`/`select` calls. The plugin already expects raw SQL strings — adding an ORM creates an impedance mismatch.
- **If Electron:** Drizzle ORM with `better-sqlite3` driver for maximum type safety with minimal overhead.
- **Avoid Prisma** — the 15-30MB query engine binary is unjustifiable for a single-user desktop app.

---

## Decision 8: Schema Migration Strategy — **Custom Versioned Scripts (Confirmed)**

Use SQLite's built-in `PRAGMA user_version` for tracking schema version. This is the standard approach for desktop apps (VS Code, Obsidian, and many Electron apps use this pattern).

```
App starts -> read PRAGMA user_version -> apply any pending migrations in order -> set new version
```

Each migration is a set of SQL statements run in a transaction. If a migration fails, the database stays at the previous version.

**Why not ORM-managed migrations?**
- `drizzle-kit` and `prisma migrate` are dev-time tools that assume a development workflow. For a desktop app that auto-updates user databases at startup, a simple versioned script runner is more reliable and portable across SQLite bindings.
- If Drizzle is chosen (Electron path), Drizzle Kit can *generate* migration SQL during development, which is then embedded in the versioned runner for production.

---

## Decision 9: Timer Architecture — **Backend Process (Confirmed)**

The timer **must** run in the backend (Rust in Tauri, main process in Electron).

**Why not frontend?**
- Browser/webview `setInterval` is throttled to ~1 second minimum when the window is minimized. After extended background time, timers drift or callbacks are delayed.
- A 25-minute work interval with a minimized window may fail to trigger the alarm on time.

**Implementation approach:**
- Store the wall-clock target end time (not a countdown). Compute remaining time from `now()` on each tick.
- Tick at 250ms intervals for responsive UI updates, but correctness comes from the wall clock.
- On system sleep/wake, recalculate remaining time from the stored end time.
- Emit events to the frontend on each tick (`timer-tick`) and on completion (`timer-complete`).

```
Tauri:    Tokio async task with tokio::time::interval → emit events via app.emit()
Electron: setInterval in main process → send via mainWindow.webContents.send()
```

---

## Decision 10: Jira Integration Architecture

### Authentication

Support two methods based on Jira deployment type:

| Jira Type | Auth Method | Header |
|---|---|---|
| **Jira Cloud** | API Token (email + token) | `Authorization: Basic <base64(email:token)>` |
| **Jira Server/DC** | Personal Access Token (PAT) | `Authorization: Bearer <token>` |

User configures: base URL, auth type, and credentials in Settings.

### Ticket Validation Endpoint

```
GET {baseUrl}/rest/api/3/issue/{issueKey}?fields=summary,status    # Cloud (API v3)
GET {baseUrl}/rest/api/2/issue/{issueKey}?fields=summary,status    # Server/DC (API v2)
```

- 200 → valid, store summary/status
- 404 → issue not found
- 401/403 → auth problem
- Timeout (5s) or network error → unreachable

### Graceful Degradation (J-6, J-7, J-8)

- Global toggle to disable API verification (J-7). When off, accept any string matching `/^[A-Z][A-Z0-9]+-\d+$/`.
- Cache validation results per issue key per session to avoid repeated calls.
- When API is unreachable, show non-blocking UI note and save the link without verification (J-8).

### Credential Storage

| Shell | Method |
|---|---|
| Tauri | `keyring` crate → Windows Credential Manager |
| Electron | `safeStorage` API → DPAPI encryption |

### CORS

Jira API calls must be made from the **backend** (Rust commands or Electron main process), not the webview, to avoid CORS restrictions and keep credentials out of the renderer.

---

## Decision 11: Audio Playback

### Primary: Web Audio API in Webview

```typescript
const alarm = new Audio('./assets/sounds/alarm.mp3');
alarm.volume = 0.6;
alarm.play();
```

Works in both Tauri (WebView2) and Electron (Chromium). Sufficient when the app window is visible.

### Fallback (Tauri): `rodio` Crate in Rust

For guaranteed playback when the webview is minimized/throttled, the Rust backend can play audio via `rodio`. The backend timer completion handler triggers this.

### Alarm Sound Requirements (T-4)

- Soft chime, gentle bell, or singing bowl — not a buzzer or siren.
- Short duration (1-3 seconds), played 2-3 times with 1-2 second gaps.
- Gentle attack (fade-in over 100-200ms).
- Volume configurable in settings.
- Source: Freesound.org (CC0), Mixkit (free license), or Pixabay (free license).

---

## Decision 12: MCP Integration (D-4, TK-13)

### Phase 1 (MVP): Official SQLite MCP Server

Use `@anthropic-ai/mcp-server-sqlite` pointed at the Pomo database file. Zero custom code required.

```json
{
  "mcpServers": {
    "pomo-db": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-sqlite", "--db-path", "/path/to/pomo.db"]
    }
  }
}
```

This gives AI agents (Claude Desktop, Claude Code) full SQL access to query tasks, intervals, and settings.

**Requirement:** Enable WAL mode so the MCP server can read concurrently with the app's writes.

### Phase 2 (Optional): Custom MCP Server

Build a thin MCP server exposing domain-specific tools (`get_tasks_for_date`, `get_pomodoro_summary`, `get_tasks_by_jira_ticket`) for a better AI interaction experience. Use `@modelcontextprotocol/sdk` (TypeScript).

### Schema Design for AI Parsability

- Descriptive table/column names (no abbreviations).
- ISO 8601 timestamps (human-readable, AI-readable).
- Text enums with CHECK constraints (e.g., `CHECK(status IN ('pending', 'completed', 'abandoned'))`).
- Explicit foreign keys with `PRAGMA foreign_keys = ON`.

---

## Decision 13: Preliminary Database Schema

```sql
-- ============================================================
-- Pomo Database Schema v1
-- ============================================================
PRAGMA foreign_keys = ON;

-- ============================================================
-- User Settings (P-2, P-3, P-4)
-- Key-value for maximum extensibility without migrations.
-- ============================================================
CREATE TABLE user_settings (
    key         TEXT PRIMARY KEY NOT NULL,
    value       TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'string'
                CHECK (type IN ('string', 'integer', 'real', 'boolean', 'json')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

INSERT INTO user_settings (key, value, type) VALUES
    ('work_duration_minutes',        '25',    'integer'),
    ('short_break_duration_minutes', '5',     'integer'),
    ('long_break_duration_minutes',  '15',    'integer'),
    ('long_break_frequency',         '4',     'integer'),
    ('jira_base_url',                '',      'string'),
    ('jira_api_enabled',             'false', 'boolean');

-- ============================================================
-- Timer Intervals (T-5)
-- Each completed timer interval (work or break).
-- Timestamps are ISO 8601 UTC.
-- ============================================================
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

-- ============================================================
-- Tasks (TK-1 through TK-13)
-- Tasks scoped to a calendar day. One level of subtasks via
-- parent_task_id. Cross-day copies linked via linked_from_task_id.
-- ============================================================
CREATE TABLE tasks (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    day_date            TEXT NOT NULL,   -- YYYY-MM-DD (TK-4)
    status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'completed', 'abandoned')),
    parent_task_id      INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
    linked_from_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    jira_key            TEXT,            -- e.g. 'LRE-123' (J-1)
    tag                 TEXT,            -- free-text tag (TK-9)
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

-- ============================================================
-- Task-Interval Links (T-6, T-7)
-- Junction table: multiple tasks can link to one interval,
-- and a task can link to multiple intervals.
-- ============================================================
CREATE TABLE task_interval_links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    interval_id INTEGER NOT NULL REFERENCES timer_intervals(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    UNIQUE(task_id, interval_id)
);

CREATE INDEX idx_task_interval_links_task ON task_interval_links (task_id);
CREATE INDEX idx_task_interval_links_interval ON task_interval_links (interval_id);

-- Set schema version
-- PRAGMA user_version = 1;
```

### Schema Design Rationale

| Decision | Rationale |
|---|---|
| **user_settings as key-value** | P-4 requires extensibility without breaking existing data. New settings = new rows, zero migrations. |
| **tasks.parent_task_id (self-referential FK)** | Models one level of subtasks. Trigger prevents deeper nesting. CASCADE deletes subtasks with parent. |
| **tasks.linked_from_task_id** | Cross-day copy lineage (TK-6). SET NULL preserves copy if original is deleted. |
| **tasks.jira_key on every row** | Denormalized from parent for simpler queries. App layer copies parent's jira_key to subtasks (J-4). |
| **task_interval_links as junction table** | Many-to-many: multiple tasks per interval (T-6), and a task worked across multiple pomodoros. |
| **TEXT timestamps in ISO 8601 UTC** | SQLite has no native datetime. ISO 8601 is human-readable, sorts correctly, and AI agents parse it trivially. |
| **position column** | Integer ordering for drag-and-drop reordering (TK-3). |

---

## Decision 14: Packaging & Distribution

| | Tauri | Electron |
|---|---|---|
| **Build command** | `cargo tauri build` | `electron-builder build` |
| **Windows output** | NSIS `.exe` installer (5-15 MB) | NSIS `.exe` installer (85-120 MB) |
| **Auto-update** | `tauri-plugin-updater` (signed manifests) | `electron-updater` (GitHub Releases) |
| **Code signing** | Optional. Azure Trusted Signing (~$10/mo) when distributing. | Same. |
| **WebView2 dep** | Pre-installed on Win 10/11. Bootstrapper bundled for edge cases. | N/A (bundles Chromium). |

---

## Recommended Full Stack (Tauri + React)

Based on the analysis across all dimensions:

```
Shell:              Tauri v2
Frontend:           React 19 + TypeScript
Build:              Vite 6+
Components:         shadcn/ui (Radix primitives + Tailwind CSS)
State:              Zustand
Drag-and-drop:      @dnd-kit/core + @dnd-kit/sortable
Charts:             Chart.js v4 + react-chartjs-2
Date navigation:    react-day-picker
Forms:              React Hook Form + Zod
Audio:              Web Audio API + rodio (Rust fallback)
Database:           SQLite via tauri-plugin-sql
Query layer:        Raw SQL with typed TypeScript repository wrappers
Migrations:         Custom versioned scripts via PRAGMA user_version
Jira HTTP:          reqwest (Rust) via Tauri commands
Credentials:        keyring crate (Windows Credential Manager)
MCP:                @anthropic-ai/mcp-server-sqlite (Phase 1)
Packaging:          NSIS installer via Tauri bundler
```

---

## Decision 15: Testing Strategy

Testing is organized into four layers, from fastest/cheapest to slowest/most expensive.

### Layer 1: Unit Tests (Vitest + React Testing Library)

**Runner: Vitest** — Vite-native, fast, Jest-compatible API. Shares the same Vite config as the app (no duplicate build config).

| What to test | Tool | Examples |
|---|---|---|
| **Utility functions** | Vitest | Time formatting, ISO 8601 helpers, Jira key validation regex, position reordering logic |
| **Zustand stores** | Vitest | Timer store state transitions (idle→running→paused→completed), task store CRUD |
| **React components** | Vitest + React Testing Library | Timer display renders correct time, task panel shows title/tag/Jira link, checkbox toggles completion, settings form validates inputs |
| **Zod schemas** | Vitest | Form validation rules, API response parsing |
| **SQL query builders** | Vitest | Typed repository wrappers produce correct SQL strings |

**React Testing Library** tests components by user-visible behavior (click buttons, check text content), not implementation details. This aligns with spec G-1 (mouse-driven).

```
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Vitest config:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', '**/*.d.ts'],
    },
  },
});
```

### Layer 2: Rust Backend Unit Tests

Rust has a built-in test framework. Test the backend logic that runs in the Tauri process.

| What to test | How |
|---|---|
| **Timer state machine** | Test state transitions: start, pause, resume, cancel, complete. Verify wall-clock end time calculations. |
| **Database migrations** | Create in-memory SQLite DB, run all migrations, assert schema matches expectations. |
| **SQL queries** | Use an in-memory SQLite DB with seed data. Assert CRUD operations, cascade deletes, trigger enforcement (single-level subtasks). |
| **Jira validation logic** | Test response parsing for 200, 401, 403, 404 status codes. Test timeout handling. Mock HTTP responses with `mockito` or `wiremock` crate. |
| **Settings read/write** | Test key-value storage and type coercion. |

```rust
#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    #[test]
    fn test_migration_applies_cleanly() {
        let db = Connection::open_in_memory().unwrap();
        run_migrations(&db).unwrap();
        // Verify tables exist
        let tables: Vec<String> = db
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();
        assert!(tables.contains(&"tasks".to_string()));
        assert!(tables.contains(&"timer_intervals".to_string()));
    }

    #[test]
    fn test_subtask_nesting_trigger() {
        let db = setup_test_db();
        // Create parent task
        db.execute("INSERT INTO tasks (title, day_date, position) VALUES ('Parent', '2026-02-14', 0)", []).unwrap();
        // Create subtask
        db.execute("INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES ('Sub', '2026-02-14', 0, 1)", []).unwrap();
        // Attempt to nest a subtask under a subtask — should fail
        let result = db.execute("INSERT INTO tasks (title, day_date, position, parent_task_id) VALUES ('SubSub', '2026-02-14', 0, 2)", []);
        assert!(result.is_err());
    }
}
```

Run with `cargo test` from `src-tauri/`.

### Layer 3: Integration Tests (Tauri IPC)

Test the frontend↔backend boundary — that Tauri commands return correct data and events fire correctly.

**Approach: Vitest with mocked `@tauri-apps/api`**

Mock the Tauri `invoke` and `listen` functions to test that the frontend correctly calls commands and handles events without needing a running Tauri process.

```typescript
// src/test/mocks/tauri.ts
import { vi } from 'vitest';

export const mockInvoke = vi.fn();
export const mockListen = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}));
```

Test that:
- `startTimer` command is called with correct args when user clicks Start.
- `timer-tick` events update the Zustand store and UI.
- `timer-complete` events trigger the task association dialog.
- Task CRUD commands send correct payloads and UI updates on response.
- Jira validation displays success/error states correctly.

### Layer 4: End-to-End Tests (WebdriverIO + Tauri)

Tauri v2 supports WebDriver testing via its built-in WebDriver server. **WebdriverIO** is the recommended E2E framework for Tauri apps.

```
npm install -D @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter
```

**What to cover with E2E (keep this layer thin — test critical flows only):**

| Flow | What to verify |
|---|---|
| **Full pomodoro cycle** | Start work timer → wait for completion (use short duration in test mode) → alarm fires → associate tasks → verify interval logged in DB |
| **Task lifecycle** | Create task → add subtask → reorder → mark subtask complete → mark parent complete → verify in DB |
| **Task copy across days** | Create task on Day 1 → navigate to Day 2 → copy task → verify link to original |
| **Settings persistence** | Change work duration → restart app → verify setting applied |
| **Jira validation** | Enter valid ticket key → see summary displayed. Enter invalid key → see error. Toggle API off → key accepted without call. |

**WebdriverIO config for Tauri:**

```typescript
// wdio.conf.ts
export const config = {
  runner: 'local',
  specs: ['./e2e/**/*.test.ts'],
  capabilities: [{
    'tauri:options': {
      application: './src-tauri/target/release/pomo.exe',
    },
  }],
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: { timeout: 60000 },
};
```

### Test Data & Fixtures

- **Test mode flag:** The app accepts a `--test` CLI arg or `POMO_TEST=1` env var that:
  - Uses an in-memory or temp-directory SQLite database (not the user's real data).
  - Shortens timer durations (e.g., 2-second "pomodoro" for E2E tests).
  - Disables alarm audio (or uses a silent stub).
- **Seed data:** SQL fixture files that populate the test DB with realistic data (tasks across multiple days, completed intervals, Jira links) for reporting view tests.

### Mocking External Dependencies

| Dependency | Mock Strategy |
|---|---|
| **Jira API** | **MSW (Mock Service Worker)** in Vitest/integration tests. Intercepts `fetch` calls and returns fixture responses. In Rust tests, use the `mockito` crate. |
| **Tauri IPC** | Mock `invoke`/`listen` in Vitest (see Layer 3 above). |
| **Audio** | Stub `new Audio()` in jsdom. In E2E, verify the alarm event fires rather than testing actual audio output. |
| **System clock** | Use `vi.useFakeTimers()` in Vitest for timer unit tests. In Rust, inject a clock trait for testable time. |
| **File system (DB path)** | Use temp directories in tests. Rust: `tempfile` crate. Node: `os.tmpdir()`. |

### CI Pipeline

```
┌─────────────────────────────────────────────┐
│  1. Lint        → biome check (TS) + clippy (Rust)   │
│  2. Type check  → tsc --noEmit                        │
│  3. Unit tests  → vitest run (frontend)               │
│  4. Rust tests  → cargo test (backend)                │
│  5. Build       → cargo tauri build                   │
│  6. E2E tests   → wdio run (against built binary)     │
└─────────────────────────────────────────────┘
```

Steps 1-4 run in parallel. Step 5 depends on 1-4 passing. Step 6 depends on 5.

### Coverage Targets

| Layer | Target | Rationale |
|---|---|---|
| Rust backend (timer, DB, Jira) | **80%+** | Core business logic — highest value per test |
| Zustand stores | **90%+** | State transitions are the app's backbone |
| React components | **60-70%** | Test behavior, not styling. Skip trivial render-only components. |
| E2E flows | **5-8 critical paths** | Catch integration breakage. Not for exhaustive coverage. |

### Recommended Test Libraries Summary

```
Frontend unit/integration:
  vitest                          Test runner (Vite-native, Jest-compatible)
  @testing-library/react          Component testing by behavior
  @testing-library/user-event     Simulates real user interactions
  @testing-library/jest-dom       DOM assertion matchers
  jsdom                           Browser environment for Vitest
  msw                             Jira API mocking (Mock Service Worker)

Rust backend:
  (built-in)                      #[test], #[cfg(test)]
  mockito                         HTTP mock server for Jira API tests
  tempfile                        Temp directories for DB tests

E2E:
  @wdio/cli                       WebdriverIO test runner
  @wdio/local-runner              Local Tauri binary runner
  @wdio/mocha-framework           Test framework

Linting:
  biome                           Fast TS/JS linter + formatter (replaces ESLint + Prettier)
  clippy                          Rust linter (built into cargo)
```

---

## Confirmed Stack

All decisions are now finalized:

```
Shell:              Tauri v2
Frontend:           React 19 + TypeScript
Build:              Vite 6+
Components:         shadcn/ui (Radix primitives + Tailwind CSS)
State:              Zustand
Drag-and-drop:      @dnd-kit/core + @dnd-kit/sortable
Charts:             Chart.js v4 + react-chartjs-2
Date navigation:    react-day-picker
Forms:              React Hook Form + Zod
Audio:              Web Audio API + rodio (Rust fallback)
Database:           SQLite via tauri-plugin-sql
Query layer:        Raw SQL with typed TypeScript repository wrappers
Migrations:         Custom versioned scripts via PRAGMA user_version
Jira HTTP:          reqwest (Rust) via Tauri commands
Credentials:        keyring crate (Windows Credential Manager)
MCP:                @anthropic-ai/mcp-server-sqlite (Phase 1)
Packaging:          NSIS installer via Tauri bundler

Testing:
  Frontend unit:    Vitest + React Testing Library
  Backend unit:     cargo test (rusqlite in-memory)
  Integration:      Vitest with mocked Tauri IPC
  E2E:              WebdriverIO (Tauri WebDriver)
  API mocking:      MSW (frontend) + mockito (Rust)
  Linting:          Biome (TS) + Clippy (Rust)
```
