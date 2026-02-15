# Pomo

A local-first Pomodoro timer desktop app built with Tauri v2 and React 19. Combines timer management, task tracking, and reporting for focused work sessions.

**Platform:** Windows 10/11

## Prerequisites

Install the following before setting up the project:

| Tool | Minimum Version | Install |
|------|----------------|---------|
| **Node.js** | 20+ | [nodejs.org](https://nodejs.org/) |
| **Rust** | stable (1.75+) | [rustup.rs](https://rustup.rs/) |
| **WebView2** | Latest | Pre-installed on Windows 10/11. If missing: [download](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |

Verify your installations:

```bash
node --version    # v20+
npm --version     # 10+
rustc --version   # 1.75+
cargo --version
```

### Windows Build Tools

Rust on Windows requires the MSVC build tools. If you installed Rust via `rustup`, it should have prompted you to install these. If not, install **Visual Studio Build Tools** with the "Desktop development with C++" workload from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/visual-cpp-build-tools/).

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd pomo

# Install frontend dependencies
npm install

# Run the full app (Vite HMR + Rust backend)
npm run tauri dev
```

The first run will compile the Rust backend, which takes a few minutes. Subsequent runs use cached builds and start much faster.

The app opens at **480x720** by default. The Vite dev server runs on `http://localhost:1420`.

## Development Commands

### Run

```bash
npm run tauri dev     # Full app — Vite + Tauri (recommended)
npm run dev           # Vite frontend only (no Rust backend)
```

### Build

```bash
npm run typecheck     # TypeScript type checking
npm run build         # Build frontend (tsc + Vite)
npm run build:portable # Build portable exe (no installer)
```

### Test

```bash
npm run test          # Run Vitest (single run)
npm run test:watch    # Run Vitest in watch mode
npm run test:coverage # Run Vitest with coverage report
```

**Rust tests** must be run from the `src-tauri/` directory with `--no-default-features` (the dialog plugin crashes test binaries otherwise):

```bash
cd src-tauri
cargo test --no-default-features
cargo clippy -- -D warnings
```

### Lint

```bash
npm run lint          # Check with Biome
npm run lint:fix      # Auto-fix with Biome
```

## Project Structure

```
pomo/
├── src/                      # React frontend
│   ├── components/           # UI components (timer, tasks, reports, settings)
│   │   └── ui/               # shadcn/ui primitives
│   ├── stores/               # Zustand state (timerStore, taskStore, reportStore)
│   └── lib/                  # DB singleton, repositories, schemas, utils
├── src-tauri/                # Rust backend
│   └── src/                  # timer.rs, tasks.rs, reports.rs, audio.rs, etc.
├── public/sounds/            # Alarm audio files
├── docs/                     # Specs, tech decisions, dev plan
└── .github/workflows/        # CI pipeline
```

## Tech Stack

- **Runtime:** Tauri v2 (Rust + WebView2)
- **Frontend:** React 19, TypeScript 5.8, Vite 7
- **UI:** shadcn/ui (Radix + Tailwind CSS v4), Zustand 5
- **Database:** SQLite via rusqlite (Rust) and tauri-plugin-sql (frontend)
- **Testing:** Vitest + React Testing Library (frontend), cargo test (Rust)
- **Linting:** Biome (TypeScript/JS), Clippy (Rust)

## Portable Build

Pomo ships as a portable executable — no installer required. This is ideal for IT-locked machines where you can't install software.

### Building

```bash
npm run build:portable
```

The compiled exe is at `src-tauri/target/release/pomo.exe`. All frontend assets are embedded in the binary.

### Creating a portable distribution

1. Copy `pomo.exe` to a folder (e.g., `pomo-portable/`)
2. Create an empty file called `portable` (no extension) in the same folder
3. Optionally zip the folder for distribution

```
pomo-portable/
  pomo.exe
  portable
```

The `portable` file tells the app to store all data next to the exe instead of in `%APPDATA%`. On first launch, the app automatically creates a `data/` folder:

```
pomo-portable/
  pomo.exe
  portable
  data/
    pomo.db
    config.json
```

To uninstall, just delete the folder.

### Without portable mode

If you run `pomo.exe` without the `portable` marker file, it behaves like a standard installed app and stores data in `%APPDATA%/com.pomo.app/`.

### Requirements

- **WebView2 runtime** — Ships with Windows 11. Windows 10 users may need to install it from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

## Database

The app uses an embedded SQLite database. On first run, it automatically creates and migrates the database — no manual setup required.

In portable mode, the database is stored in the `data/` folder next to the exe. Otherwise, it's stored in `%APPDATA%/com.pomo.app/`. The path can be configured in the app's settings.

## Troubleshooting

### `npm run tauri dev` fails to compile Rust

- Ensure the MSVC build tools are installed (see [Prerequisites](#windows-build-tools)).
- Run `rustup update` to get the latest stable toolchain.

### Port 1420 already in use

The Vite dev server requires port 1420 (configured in `src-tauri/tauri.conf.json`). Kill any process using that port before running `npm run tauri dev`.

### Rust tests crash with `STATUS_ENTRYPOINT_NOT_FOUND`

Always run Rust tests with `--no-default-features`:

```bash
cd src-tauri
cargo test --no-default-features
```

The `dialog` feature (enabled by default) links to Tauri desktop APIs that aren't available in test binaries.

### WebView2 not found

On rare Windows setups, WebView2 may be missing. Download the Evergreen Bootstrapper from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) and install it.

### Slow first build

The first `npm run tauri dev` or `npm run tauri build` compiles all Rust dependencies from scratch. This is normal and can take 3-10 minutes depending on your machine. Subsequent builds are incremental and much faster.

## CI

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs on every push and PR to `main`:

1. Biome lint
2. TypeScript typecheck
3. Vitest
4. Clippy
5. Rust tests
6. Tauri build
