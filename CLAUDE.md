# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pomo is a local-first Pomodoro timer desktop application built with Tauri v2 + React 19. It combines timer management, task tracking, optional Jira integration, and reporting to support focused work sessions throughout a full working day.

**Target platform:** Windows 10/11 desktop (NSIS installer).

**Reference docs:**
- [pomo-spec.md](./docs/pomo-spec.md) — Functional specification (requirements T-1..T-7, TK-1..TK-13, J-1..J-8, etc.)
- [pomo-tech.md](./docs/pomo-tech.md) — Technical architecture decisions and confirmed stack
- [pomo-dev-plan.md](./docs/pomo-dev-plan.md) — Milestones, PRs, and UAT criteria

## Tech Stack

```
Shell:              Tauri v2 (Rust backend + WebView2)
Frontend:           React 19 + TypeScript
Build:              Vite 6+
Components:         shadcn/ui (Radix primitives + Tailwind CSS v4)
State:              Zustand
Drag-and-drop:      @dnd-kit/core + @dnd-kit/sortable
Charts:             Chart.js v4 + react-chartjs-2
Date navigation:    react-day-picker
Forms:              React Hook Form + Zod
Audio:              Web Audio API + rodio (Rust fallback)
Database:           SQLite via tauri-plugin-sql + rusqlite
Query layer:        Raw SQL with typed TypeScript repository wrappers
Migrations:         Custom versioned scripts via PRAGMA user_version
Jira HTTP:          reqwest (Rust) via Tauri commands
Credentials:        keyring crate (Windows Credential Manager)
MCP:                @anthropic-ai/mcp-server-sqlite
Packaging:          NSIS installer via Tauri bundler
```

## Testing Stack

```
Frontend unit:      Vitest + React Testing Library + jsdom
Backend unit:       cargo test (rusqlite in-memory DB)
Integration:        Vitest with mocked Tauri IPC (@tauri-apps/api)
E2E:                WebdriverIO (Tauri WebDriver)
API mocking:        MSW (frontend) + mockito (Rust)
Linting:            Biome (TS/JS) + Clippy (Rust)
Coverage:           v8 provider via Vitest
```

## Project Structure (Expected)

```
pomo/
├── docs/                   # Spec, tech decisions, dev plan
├── src/                    # React frontend
│   ├── components/         # UI components (shadcn/ui based)
│   ├── stores/             # Zustand stores (timer, tasks, settings)
│   ├── repositories/       # Typed SQL wrappers for tauri-plugin-sql
│   ├── lib/                # Utilities, Zod schemas, types
│   └── test/               # Test setup and mocks
├── src-tauri/              # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs         # Tauri entry point
│   │   ├── lib.rs          # Tauri app builder and command registration
│   │   ├── timer.rs        # Timer state machine (Tokio async)
│   │   ├── db.rs           # Database migrations and setup
│   │   ├── jira.rs         # Jira API validation (reqwest)
│   │   └── commands/       # Tauri command handlers
│   ├── migrations/         # SQL migration scripts
│   └── Cargo.toml
├── e2e/                    # WebdriverIO E2E tests
├── CLAUDE.md               # This file
├── biome.json              # Biome linter/formatter config
├── vitest.config.ts        # Vitest config
├── tailwind.config.ts      # Tailwind CSS config
├── tsconfig.json           # TypeScript config (strict mode, path aliases)
├── vite.config.ts          # Vite config
└── package.json
```

## Build & Run Commands

```bash
# Development
cargo tauri dev              # Launch app in dev mode (Vite HMR + Rust backend)

# Frontend
npm run test                 # Run Vitest unit/integration tests
npm run test:coverage        # Run tests with v8 coverage
npm run lint                 # Biome lint check
npm run lint:fix             # Biome lint + auto-fix
npm run typecheck            # tsc --noEmit

# Backend (from src-tauri/)
cargo test                   # Run Rust unit tests
cargo clippy                 # Rust linter

# Production build
cargo tauri build            # Build NSIS installer
```

## Architecture Notes

### Timer System
- Timer runs as a Tokio async task in the Rust backend — never in the frontend (webview throttling breaks timers when minimized).
- Uses wall-clock end time, not a countdown. Remaining time computed from `Instant::now()` on each tick (250ms interval).
- Timer emits `timer-tick` and `timer-complete` events to the frontend via Tauri's event system.
- States: `Idle → Running → Paused → Running → Idle` (on complete or cancel).
- Timers and tasks are loosely coupled — association happens after a work interval completes via a checkbox dialog.

### Database
- SQLite with 4 tables: `user_settings`, `timer_intervals`, `tasks`, `task_interval_links`.
- Schema managed via `PRAGMA user_version` (currently v1).
- `PRAGMA foreign_keys = ON` on every connection.
- WAL mode for local paths; `journal_mode=DELETE` for cloud-synced paths (OneDrive/Dropbox).
- Tasks support one level of subtasks via `parent_task_id` (enforced by trigger).
- Cross-day task copies linked via `linked_from_task_id`.
- All timestamps are ISO 8601 UTC text.

### Jira Integration
- Read-only integration — no data is written back to Jira.
- HTTP requests made from Rust backend (reqwest) to avoid CORS.
- Supports Jira Cloud (API token) and Jira Server/DC (PAT).
- Graceful degradation: API unavailable → save link unverified with UI note.
- API validation can be toggled off entirely in settings.

### Frontend Patterns
- Zustand stores for timer state, task state, and settings.
- Typed TypeScript repository wrappers around `tauri-plugin-sql` `execute`/`select` calls (no ORM).
- Zod schemas for runtime validation of DB results and form inputs.
- shadcn/ui components with Tailwind CSS for styling.

## Development Plan (10 Milestones)

1. **M1: Scaffolding** — Tauri + React + tooling setup, CI pipeline
2. **M2: Database** — SQLite schema, migrations, TypeScript repository layer
3. **M3: Timer** — Rust state machine + frontend timer UI
4. **M4: Tasks** — CRUD, subtasks, drag-and-drop, day scoping
5. **M5: Timer-Task Link** — Post-interval task association dialog
6. **M6: Settings** — Configurable durations, presets, persistence
7. **M7: Jira** — Credential storage, ticket validation, task linking
8. **M8: Task History** — Past day review, copy tasks forward
9. **M9: Reporting** — Daily/weekly/monthly summaries, visual timeline
10. **M10: Polish** — Audio, MCP docs, UI polish, installer

Branch naming: `feat/M{n}-{description}` (e.g., `feat/M1-scaffolding`). All PRs target `main`.

## Key Conventions

- **No ORMs** — raw SQL with typed wrappers. The Tauri plugin expects raw SQL strings.
- **Backend timer, frontend display** — timer logic always in Rust, UI subscribes to events.
- **ISO 8601 UTC** for all timestamps in the database.
- **Single-level subtasks only** — enforced at both DB trigger and app level.
- **Day-scoped tasks** — every task belongs to a specific calendar day (YYYY-MM-DD).
- **Biome** for TS/JS linting and formatting (not ESLint/Prettier).
- **Clippy** for Rust linting.

## Keeping This File Updated

This CLAUDE.md should be updated when:
- New dependencies are added or removed
- Project structure changes (new directories, renamed files)
- Build/run commands change
- Architectural patterns are established or modified
- New conventions are adopted
