import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "get_tasks_by_date") return [];
    return {
      state: "idle",
      interval_type: "work",
      remaining_ms: 0,
      planned_duration_seconds: 0,
      interval_id: null,
      completed_work_count: 0,
    };
  }),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("@/lib/settingsRepository", () => ({
  getAll: vi.fn(async () => []),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
  Toaster: () => null,
}));

const App = (await import("./App")).default;

describe("App", () => {
  it("renders the app heading", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByText("Pomo")).toBeInTheDocument();
  });

  it("renders the start timer button", async () => {
    await act(async () => {
      render(<App />);
    });
    expect(screen.getByRole("button", { name: /start/i })).toBeInTheDocument();
  });
});
