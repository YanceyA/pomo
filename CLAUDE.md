# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pomo is a local-first Pomodoro timer desktop application built with Tauri v2 + React 19. It combines timer management, task tracking, optional Jira integration, and reporting to support focused work sessions throughout a full working day.

**Target platform:** Windows 10/11 desktop (NSIS installer).

**Current status:** M1 PR 1.1 complete — project scaffolding with all dependencies installed. App shell renders "Pomo" with a styled shadcn/ui Button in a Tauri window.

**Reference docs:**
- [pomo-spec.md](./docs/pomo-spec.md) — Functional specification (requirements T-1..T-7, TK-1..TK-13, J-1..J-8, etc.)
- [pomo-tech.md](./docs/pomo-tech.md) — Technical architecture decisions and confirmed stack
- [pomo-dev-plan.md](./docs/pomo-dev-plan.md) — Milestones, PRs, and UAT criteria

## Tech Stack (Installed)

```
Shell:              Tauri v2.10 (Rust backend + WebView2)
Frontend:           React 19.1 + TypeScript 5.8
Build:              Vite 7
Components:         shadcn/ui (Radix primitives + Tailwind CSS v4)
State:              Zustand 5
Drag-and-drop:      @dnd-kit/core 6 + @dnd-kit/sortable 10
Charts:             Chart.js 4 + react-chartjs-2 5
Date navigation:    react-day-picker 9
Forms:              React Hook Form 7 + Zod 4
Styling:            Tailwind CSS v4 (via @tailwindcss/vite plugin)
UI utilities:       class-variance-authority, clsx, tailwind-merge, lucide-react
Packaging:          NSIS installer via Tauri bundler
```

### Not Yet Installed (Future Milestones)
```
Audio:              Web Audio API + rodio (Rust fallback) — M10
Database:           tauri-plugin-sql + rusqlite — M2
Jira HTTP:          reqwest (Rust) — M7
Credentials:        keyring crate — M7
MCP:                @anthropic-ai/mcp-server-sqlite — M10
Testing:            Vitest, RTL, Biome, Clippy — M1 PR 1.2
```

## Project Structure (Actual)

```
pomo/
├── docs/                       # Spec, tech decisions, dev plan
├── src/                        # React frontend
│   ├── components/
│   │   └── ui/
│   │       └── button.tsx      # shadcn/ui Button component
│   ├── lib/
│   │   └── utils.ts            # cn() utility (clsx + tailwind-merge)
│   ├── App.tsx                 # Root component — "Pomo" heading + Button
│   ├── main.tsx                # React entry point
│   ├── index.css               # Tailwind CSS v4 + shadcn/ui theme variables
│   └── vite-env.d.ts           # Vite type declarations
├── src-tauri/                  # Rust backend (Tauri)
│   ├── src/
│   │   ├── main.rs             # Windows entry point → pomo_lib::run()
│   │   └── lib.rs              # Tauri app builder
│   ├── capabilities/
│   │   └── default.json        # Tauri capability permissions
│   ├── icons/                  # App icons (various sizes)
│   ├── build.rs                # Tauri build script
│   ├── Cargo.toml              # Rust dependencies
│   └── tauri.conf.json         # Tauri config (app name, window size, bundling)
├── public/                     # Static assets served by Vite
├── CLAUDE.md                   # This file
├── components.json             # shadcn/ui configuration
├── tsconfig.json               # TypeScript config (strict, path aliases: @/ → src/)
├── tsconfig.node.json          # TypeScript config for Vite/Node files
├── vite.config.ts              # Vite config (React, Tailwind, path aliases)
├── package.json                # npm scripts and dependencies
└── index.html                  # HTML entry point
```

## Build & Run Commands

```bash
# Development
npm run tauri dev            # Launch app in dev mode (Vite HMR + Rust backend)
npm run dev                  # Start Vite dev server only (no Tauri)

# Frontend checks
npm run typecheck            # tsc --noEmit
npm run build                # tsc && vite build (production frontend build)

# Backend (from src-tauri/)
cargo check                  # Fast Rust compile check
cargo build                  # Full Rust build

# Production build
npm run tauri build          # Build NSIS installer
```

### Not Yet Configured (M1 PR 1.2)
```bash
npm run test                 # Vitest (not yet installed)
npm run test:coverage        # Vitest + v8 coverage (not yet installed)
npm run lint                 # Biome (not yet installed)
npm run lint:fix             # Biome auto-fix (not yet installed)
cargo test                   # Rust tests (not yet written)
cargo clippy                 # Clippy (not yet configured)
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
- **Path aliases:** `@/` maps to `./src/` (configured in tsconfig.json and vite.config.ts).
- **Tailwind CSS v4:** Uses `@tailwindcss/vite` plugin — no `tailwind.config.ts` file. Theme configured in `src/index.css` using `@theme` directives.
- **shadcn/ui:** Components in `src/components/ui/`. Add new components with `npx shadcn@latest add <name>`. Config in `components.json`.
- Zustand stores for timer state, task state, and settings.
- Typed TypeScript repository wrappers around `tauri-plugin-sql` `execute`/`select` calls (no ORM).
- Zod schemas for runtime validation of DB results and form inputs.

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
- **shadcn/ui** components added via CLI (`npx shadcn@latest add <name>`), not manually created.

## Keeping This File Updated

This CLAUDE.md should be updated when:
- New dependencies are added or removed
- Project structure changes (new directories, renamed files)
- Build/run commands change
- Architectural patterns are established or modified
- New conventions are adopted
