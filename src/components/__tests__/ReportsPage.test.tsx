import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("chart.js", () => ({
  Chart: { register: vi.fn() },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  Tooltip: {},
  Legend: {},
}));

vi.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="mock-bar-chart" />,
}));

const { useReportStore } = await import("@/stores/reportStore");
const { ReportsPage } = await import("../ReportsPage");

const dailyData = {
  date: "2026-02-15",
  pomodoro_count: 0,
  total_focus_minutes: 0,
  tasks_completed: 0,
  tasks_total: 0,
  intervals: [],
  task_groups: [],
};

const weeklyData = {
  week_start: "2026-02-10",
  week_end: "2026-02-16",
  daily_stats: [],
  total_pomodoros: 0,
  total_focus_minutes: 0,
  total_tasks_completed: 0,
  task_groups: [],
};

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_daily_summary") return Promise.resolve(dailyData);
      if (cmd === "get_weekly_summary") return Promise.resolve(weeklyData);
      return Promise.resolve(null);
    });
    useReportStore.setState({
      activeTab: "daily",
      dailySummary: null,
      isDailyLoading: false,
      weeklySummary: null,
      isWeeklyLoading: false,
    });
  });

  it("renders Reports heading", () => {
    render(<ReportsPage />);
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("renders Daily and Weekly tabs", () => {
    render(<ReportsPage />);
    expect(screen.getByRole("tab", { name: "Daily" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Weekly" })).toBeInTheDocument();
  });

  it("defaults to daily tab active", () => {
    render(<ReportsPage />);
    const dailyTab = screen.getByRole("tab", { name: "Daily" });
    expect(dailyTab).toHaveAttribute("data-state", "active");
  });

  it("switches to weekly tab on click", async () => {
    const user = userEvent.setup();
    render(<ReportsPage />);

    await user.click(screen.getByRole("tab", { name: "Weekly" }));

    await waitFor(() => {
      const weeklyTab = screen.getByRole("tab", { name: "Weekly" });
      expect(weeklyTab).toHaveAttribute("data-state", "active");
    });
  });
});
