# Pomo - Software Specification

## 1. Overview

Pomo is a local-first Pomodoro timer application designed to support a full working day. It combines timer management, task tracking, and optional Jira integration to help users plan, execute, and review focused work sessions.

**Target platform:** Local desktop application (framework TBD — see Decisions Pending).

---

## 2. Timer System

- **T-1:** The user can start, stop, pause, and cancel a timer. All timers are manually started — no auto-start between intervals.
- **T-2:** Work intervals, short break intervals, and long break intervals are independently configurable. Default presets are 25/5 and 35/7 (work/short break in minutes).
- **T-3:** A long break of 15–20 minutes is triggered after every 4 completed pomodoros.
- **T-4:** A single, comfortable alarm sound plays when any interval (work or break) ends. The alarm should have a calm, non-jarring tone.
- **T-5:** Each completed interval (work or break) is logged with real-world start/end timestamps and persisted to the database.
- **T-6:** Timers run independently of tasks. When the user starts a break or a new work interval, they can select completed tasks (via checkbox) to associate with the just-finished pomodoro interval.
- **T-7:** A completed task stores a reference to the pomodoro interval it was logged against.

---

## 3. User Profile & Settings

- **P-1:** The app supports a single local user profile. Multi-user is not required.
- **P-2:** The profile persists preferences across sessions. Settings are loaded on app start and applied as defaults for new timers.
- **P-3:** Configurable settings include (at minimum): work interval duration, short break duration, long break duration, and long break frequency.
- **P-4:** The settings schema must be extensible to support future preferences (e.g., themes, notification style) without breaking existing data.

---

## 4. Task Management

- **TK-1:** The user can create, delete, and clone tasks.
- **TK-2:** Tasks support one level of subtasks. Subtasks cannot have their own subtasks.
- **TK-3:** Tasks are displayed as a flat vertical stack of concise panels that can be rearranged by the user.
- **TK-4:** Tasks are associated with the calendar day they are created. A task is scoped to a single day — users should break larger work into day-sized or few-pomo-sized tasks.
- **TK-5:** The user can review tasks from previous days.
- **TK-6:** The user can copy a task from a previous day to the current day. The original remains on its original day, and a durable link connects the copy to the original.
- **TK-7:** A task can be marked as abandoned — meaning it was relevant when created but is no longer required. Abandoned tasks remain visible in the task history to maintain a complete record of what was done, what is still required, and what was dropped.
- **TK-8:** A task can be deleted (hard removal).
- **TK-9:** Task fields: title, optional Jira ticket association, optional free-text tag.
- **TK-10:** Subtasks are independently completed. A parent task can only be marked complete once all of its subtasks are complete.
- **TK-11:** Cloning a task with no subtasks produces a single new task. Cloning a task with subtasks produces a deep copy including all subtasks.
- **TK-12:** Task completion is manual — the user explicitly marks tasks/subtasks as done.
- **TK-13:** Task data is stored in a database format that is easy for AI agents to parse.

---

## 5. Jira Integration

- **J-1:** A task can be linked to a single Jira ticket by entering a ticket key (e.g., `LRE-123`). A task cannot be linked to multiple tickets.
- **J-2:** When API verification is enabled, the system validates the ticket exists via the Jira API (one-way, read-only).
- **J-3:** The linked Jira ticket key is displayed on the task panel as a hyperlink that opens the ticket in the user's browser.
- **J-4:** Subtasks automatically inherit the Jira link from their parent task. A subtask cannot override the inherited link — a task and all its subtasks share a single Jira association.
- **J-5:** No data is written back to Jira — the integration is strictly read-only.
- **J-6:** If the Jira API is unreachable or returns an error, the user can confirm they still want to store the Jira link without verification.
- **J-7:** The user can configure whether the system uses the Jira API for ticket validation. When disabled, Jira links are accepted without any API call.
- **J-8:** If the Jira API is unavailable, the app degrades gracefully — a small UI note indicates the API is unreachable, and the association is still saved.

### Decisions Pending

- Jira authentication method (API token, OAuth) — TBD.
- Jira base URL configuration approach — TBD.

---

## 6. Data & Storage

- **D-1:** All data (timers, tasks, profile) is persisted in a database with a well-defined, extensible schema.
- **D-2:** The database file can be configured to reside at a local file path.
- **D-3:** The database file can alternatively point to a cloud-synced or network-accessible directory (e.g., OneDrive, Dropbox) containing the database and configuration files, enabling portability.
- **D-4:** The storage format must be easy for AI agents to parse (e.g., a well-structured relational schema accessible via MCP or similar tooling for alternative analysis).
- **D-5:** The app assumes single-instance access — concurrent access to the same database file is not supported.

### Decisions Pending

- Database engine — SQLite is the current preference, but final choice TBD.
- Schema migration strategy for future feature additions — TBD.

---

## 7. Reporting & Analytics

- **R-1:** The user can review completed intervals on a daily, weekly, and monthly basis.
- **R-2:** A "working day" is defined as a single calendar day (midnight to midnight).
- **R-3:** Daily and weekly summaries include total pomodoro count and tasks completed.
- **R-4:** A visual timeline shows pomodoros and breaks relative to the working day. The specific visualization format is flexible and will be iterated on during UI development.
- **R-5:** Daily and weekly wrap-ups group tasks by their linked Jira ticket, showing pomodoro count and tasks completed per ticket.
- **R-6:** Monthly reports aggregate data by week.
- **R-7:** Reports are view-only within the app — no file export (CSV, PDF, etc.) is required.

---

## 8. General Constraints

- **G-1:** The app is mouse-driven. Keyboard shortcuts are not required initially but the architecture should allow them to be added later.
- **G-2:** Notifications are limited to the in-app alarm sound — no OS-level notifications or system tray alerts.
- **G-3:** Timer and task data is retained indefinitely with no automatic purging.
- **G-4:** Timers and tasks are loosely coupled — a timer is never started "against" a task. Association happens after the fact when the user logs tasks to a completed interval.

---

## 9. Decisions Pending

A consolidated list of items that still need resolution:

1. **UI framework / tech stack** — Electron, Tauri, web-based, or native? TBD.
2. **Database engine** — SQLite is the current preference, final choice TBD.
3. **Schema migration strategy** — approach for evolving the database schema over time TBD.
4. **Jira authentication** — API token, OAuth, or other method TBD.
5. **Jira base URL configuration** — how and where the Jira instance URL is configured TBD.
