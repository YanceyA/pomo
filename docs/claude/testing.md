# Testing Reference

How to run tests, write new tests, and common patterns. Read on-demand when working on tests.

## Commands

```bash
npm run test                           # Vitest (run once)
npm run test:watch                     # Vitest (watch mode)
npm run test:coverage                  # Vitest + v8 coverage
cargo test --no-default-features       # Rust tests (from src-tauri/)
```

## Rust Test Setup

- **`common-controls-v6`** disabled in Tauri to allow `cargo test` on Windows (otherwise `STATUS_ENTRYPOINT_NOT_FOUND`).
- **`tauri-plugin-dialog`** is behind a `dialog` Cargo feature (default-enabled). Tests MUST run with `--no-default-features` because `rfd` links Windows common controls that crash test binaries. The plugin is conditionally registered with `#[cfg(feature = "dialog")]` in `lib.rs`.
- Tests use `tauri::test::mock_builder()` with `MockRuntime` (not real WebView2).
- The `test` feature is enabled on the `tauri` dependency.
- Commands are generic over `R: Runtime` so they work with both `Wry` (production) and `MockRuntime` (tests).
- `#[allow(clippy::needless_pass_by_value)]` on Tauri commands — `tauri::State` must be passed by value.

### Database Tests

- Use `rusqlite::Connection::open_in_memory()` with `PRAGMA foreign_keys = ON`.
- Run migrations via `run_migrations(&conn)` then test against the schema.

### Adding a Rust Test

1. Open the relevant module (e.g., `timer.rs`, `tasks.rs`, `database.rs`).
2. Add test function inside the existing `#[cfg(test)] mod tests { }` block.
3. Create an in-memory DB connection if needed: `let conn = Connection::open_in_memory().unwrap(); run_migrations(&conn).unwrap();`
4. For Tauri command tests, use `tauri::test::mock_builder()` to get an `AppHandle<MockRuntime>`.
5. Run: `cargo test --no-default-features` from `src-tauri/`.

## Frontend Test Setup

- Config: `vitest.config.ts` (jsdom environment, v8 coverage, `@/` path alias).
- Setup file: `src/test-setup.ts` (jest-dom matchers + ResizeObserver polyfill).
- Component tests use `@testing-library/user-event` for interaction simulation.

### Mock Patterns

**Repository tests** (mocking the DB layer):
1. Call `vi.mock("../db", ...)` before any imports.
2. Import the repository module dynamically: `const repo = await import("../repository");`
3. Use `MockDatabase` from `__tests__/db.mock.ts` (provides `select`, `execute`, `close` mocks).

**Component and store tests** (mocking Tauri APIs):
```typescript
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => vi.fn()) }));
vi.mock("@/lib/settingsRepository", () => ({ /* mock methods */ }));
```

**Zod schema tests**: validate both well-formed data acceptance and malformed data rejection.

### Adding a Frontend Test

1. Create or open a test file in the relevant `__tests__/` directory.
2. Set up mocks before imports (repository: mock `../db`; component: mock Tauri APIs).
3. Import the module under test dynamically if mocking DB: `const mod = await import("../module");`
4. Use `render()` for components, direct function calls for stores/repositories.
5. Use `userEvent` for user interactions (clicks, typing).
6. Run: `npm run test` or `npm run test:watch`.

### Sonner Toast Testing

- Sonner toasts can be asserted via `screen.getByText()` after triggering the action.
- Soft delete tests: verify toast appears with "Undo" button, verify undo cancels the delete.

## Approximate Test Counts

Run the test commands for current counts. Approximate as of M10:
- **Rust**: ~136 tests (database, timer, tasks, reports, audio, config, app smoke)
- **Vitest**: ~307 tests (schemas, repositories, stores, components)

## Test Coverage Areas

### Rust
- Database: migrations v1-v3, tables, indexes, triggers, settings, constraints, foreign keys, cloud detection
- Timer: state transitions, work count, long break reset, serde, DB operations, lifecycle
- Tasks: CRUD, subtasks, completion constraints, status transitions, clone, reorder, reopen, delete guard, copy-to-day, days-with-tasks, origin dates, task-interval links
- Reports: daily/weekly/monthly summaries, empty states, cross-day aggregation, boundary clipping
- Audio: WAV header validation, volume clamping
- Config: read/write round-trip, path resolution, reset

### Frontend
- Schemas: Zod validation (accept + reject)
- Repositories: settings, intervals, tasks, task-interval links (all via mocked DB)
- Stores: timer (state, events, commands, alarm), task (CRUD, date, dialogs, delete/undo, copy), report (tabs, date nav, loading)
- Components: all UI components with rendering, interactions, command invocations, edge cases
