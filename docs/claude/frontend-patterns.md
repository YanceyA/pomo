# Frontend Patterns Reference

Recipes and conventions for frontend development. Read on-demand when building new features.

## Zustand Store Pattern

Stores live in `src/stores/` (timerStore, taskStore, reportStore).

```typescript
export const useMyStore = create<MyStore>((set) => ({
  data: [],
  loading: false,
  loadData: async () => {
    set({ loading: true });
    const result = await invoke<MyType[]>("get_data");
    set({ data: result, loading: false });
  },
}));
```

- Use selectors for render optimization: `useMyStore((s) => s.data)`
- Actions are async functions that call `invoke()` and update state from the response.

## Tauri IPC

**Commands** (frontend -> Rust):
```typescript
const result = await invoke<ReturnType>("command_name", { param1, param2 });
```

**Events** (Rust -> frontend, in useEffect):
```typescript
const unlisten = await listen<PayloadType>("event-name", (e) => { /* e.payload */ });
return () => { unlisten(); };
```

- All commands must be registered in `lib.rs` invoke handler.
- Always call unlisten in useEffect cleanup.

## Repository Pattern

Typed wrappers in `src/lib/*Repository.ts` around `tauri-plugin-sql`:

```typescript
export async function getItems(): Promise<Item[]> {
  const db = await getDb();
  const rows = await db.select<ItemRow[]>("SELECT * FROM items WHERE day_date = $1", [date]);
  return rows.map((r) => ItemSchema.parse(r));
}
```

- Raw SQL with `$1, $2, $3` positional parameters (no ORM).
- All results parsed through Zod schemas (`src/lib/schemas.ts`). Types via `z.infer<>`.
- DB singleton: `getDb()` in `db.ts` lazily connects, calls `get_db_info` to resolve path.

## Tauri Command Pattern (Rust)

```rust
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
async fn my_command<R: Runtime>(
    state: tauri::State<'_, AppState>,
    param: String,
) -> Result<MyResponse, String> {
    let conn = Connection::open(&state.db_path).map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA foreign_keys = ON;").map_err(|e| e.to_string())?;
    // ... business logic
    Ok(response)
}
```

- Generic `R: Runtime` for testability. `needless_pass_by_value` required for `State`.
- Each command opens its own DB connection. Register in `lib.rs` generate_handler.

## Adding UI Components

```bash
npx shadcn@latest add <component-name>   # lands in src/components/ui/
```

Existing: button, badge, checkbox, dialog, input, label, calendar, popover, sheet, slider, sonner, tabs.

## Styling

- **Tailwind CSS v4** via `@tailwindcss/vite`. No config file. Theme in `src/index.css` `@theme`.
- `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge) for conditional classes.
- Path alias: `@/` -> `./src/` (tsconfig.json + vite.config.ts).

## App Layout

- `App.tsx`: Timer/Reports toggle (lucide-react icons). Timer view = TimerPage + TaskList. Reports view = ReportsPage (Daily/Weekly/Monthly tabs). SettingsPanel rendered globally (gear icon).
