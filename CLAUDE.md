# CLAUDE.md

Guidance for Claude Code when working in this repository. Detailed architecture, testing, and frontend references are in `docs/claude/` — read them on-demand when working on specific subsystems.

## Project Overview

Pomo is a local-first Pomodoro timer desktop app built with **Tauri v2 + React 19**. It combines timer management, task tracking, optional Jira integration, and reporting for focused work sessions.

**Target platform:** Windows 10/11 (NSIS installer).
**Current status:** M10 complete (alarm audio, DB path config, MCP docs). M1-M6, M8-M9 complete. M7 skipped (Jira — IT blockers). Next: M11 (UI overhaul), M12 (installer).

## Tech Stack

```
Runtime:       Tauri v2.10 (Rust + WebView2), tokio 1
Frontend:      React 19.1, TypeScript 5.8, Vite 7
UI:            shadcn/ui (Radix + Tailwind CSS v4), Zustand 5, lucide-react
DnD:           @dnd-kit/core 6 + @dnd-kit/sortable 10
Charts:        Chart.js 4 + react-chartjs-2 5 + chartjs-adapter-date-fns
Forms:         React Hook Form 7 + Zod 4
Date picker:   react-day-picker 9
Toasts:        Sonner 2
Database:      rusqlite 0.32 (Rust), tauri-plugin-sql 2 (frontend)
Date/time:     chrono 0.4
Audio:         Web Audio API + rodio 0.19 (Rust fallback)
File dialog:   tauri-plugin-dialog 2
Testing:       Vitest 4 + jsdom + RTL 16, @vitest/coverage-v8
Linting:       Biome 2 (TS/JS), Clippy pedantic (Rust)
```

## Project Layout

- `src/components/` — React components (timer, tasks, reports, settings, ui/ for shadcn)
- `src/stores/` — Zustand stores (timerStore, taskStore, reportStore)
- `src/lib/` — DB singleton, repositories (*Repository.ts), Zod schemas, audio, utils
- `src-tauri/src/` — Rust backend: timer.rs, tasks.rs, reports.rs, audio.rs, config.rs, database.rs, lib.rs
- `docs/` — Spec, tech decisions, dev plan, MCP setup, claude/ references
- `public/sounds/` — Alarm chime WAV

## Commands

```bash
# Dev
npm run tauri dev              # Full app (Vite HMR + Rust)
npm run dev                    # Vite only

# Build
npm run typecheck              # tsc --noEmit
npm run build                  # tsc && vite build
npm run tauri build            # NSIS installer

# Test
npm run test                   # Vitest (once)
npm run test:watch             # Vitest (watch)
npm run test:coverage          # Vitest + v8 coverage
cargo test --no-default-features   # Rust tests (from src-tauri/)
cargo clippy -- -D warnings        # Clippy (from src-tauri/)

# Lint
npm run lint                   # Biome check
npm run lint:fix               # Biome auto-fix
```

**CI** (`.github/workflows/ci.yml`): Biome lint -> typecheck -> Vitest -> Clippy -> cargo test -> cargo tauri build.

## Key Conventions

- **No ORMs** — raw SQL with typed wrappers. `$1, $2, $3` positional params.
- **Backend timer, frontend display** — timer logic always in Rust, UI subscribes to events.
- **ISO 8601 UTC** for all timestamps in the database.
- **Single-level subtasks only** — enforced at DB trigger and app level.
- **Day-scoped tasks** — every task belongs to a YYYY-MM-DD calendar day.
- **Biome** for TS/JS linting (not ESLint/Prettier). **Clippy** for Rust.
- **shadcn/ui** components via CLI: `npx shadcn@latest add <name>`.
- **Path alias**: `@/` maps to `./src/` (tsconfig.json + vite.config.ts).
- **Tailwind CSS v4**: `@tailwindcss/vite` plugin, no config file. Theme in `src/index.css` `@theme`.
- **Rust tests**: must use `cargo test --no-default-features` (dialog plugin crashes test binaries otherwise).

## Reference Files

Read these on-demand when working on specific subsystems:

| File | Contents |
|------|----------|
| [docs/claude/architecture.md](./docs/claude/architecture.md) | Timer, tasks, DB, audio, reporting, settings architecture |
| [docs/claude/testing.md](./docs/claude/testing.md) | Test setup, mock patterns, how to add tests |
| [docs/claude/frontend-patterns.md](./docs/claude/frontend-patterns.md) | Zustand, Tauri IPC, repository, component recipes |
| [docs/pomo-spec.md](./docs/pomo-spec.md) | Functional specification (requirements) |
| [docs/pomo-tech.md](./docs/pomo-tech.md) | Technical architecture decisions |
| [docs/pomo-dev-plan.md](./docs/pomo-dev-plan.md) | Milestones, PRs, UAT criteria |
| [docs/mcp-setup.md](./docs/mcp-setup.md) | MCP server setup for DB access |

## Todo / Learnings

<!-- Agent: Add entries here when you discover non-obvious patterns,
     debug failures, or receive user directives. Keep entries concise
     (1-2 lines each). Remove entries that become obsolete. -->

- [learning] Rust tests crash with `STATUS_ENTRYPOINT_NOT_FOUND` if dialog feature is enabled — always use `--no-default-features`
- [learning] `vi.mock()` must be called before importing the mocked module — use dynamic `await import()` for repositories
- [learning] Tauri commands need `#[allow(clippy::needless_pass_by_value)]` because `State` must be passed by value
- [directive] Branch naming: `feat/M{n}-{description}`. All PRs target `main`.

## Updating This File

Update CLAUDE.md when dependencies, structure, commands, or conventions change. Add detailed subsystem docs to `docs/claude/` files instead of here.
