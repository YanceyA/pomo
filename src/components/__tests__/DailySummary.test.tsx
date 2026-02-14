import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailySummary as DailySummaryType } from "@/lib/schemas";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const { useReportStore } = await import("@/stores/reportStore");
const { DailySummary } = await import("../DailySummary");

const makeSummary = (overrides = {}): DailySummaryType => ({
  date: "2026-02-15",
  pomodoro_count: 4,
  total_focus_minutes: 100,
  tasks_completed: 3,
  tasks_total: 5,
  intervals: [
    {
      id: 1,
      interval_type: "work",
      start_time: "2026-02-15T09:00:00Z",
      end_time: "2026-02-15T09:25:00Z",
      duration_seconds: 1500,
      planned_duration_seconds: 1500,
      status: "completed",
    },
    {
      id: 2,
      interval_type: "short_break",
      start_time: "2026-02-15T09:25:00Z",
      end_time: "2026-02-15T09:30:00Z",
      duration_seconds: 300,
      planned_duration_seconds: 300,
      status: "completed",
    },
  ],
  task_groups: [
    {
      jira_key: "PROJ-1",
      tasks: [
        {
          id: 1,
          title: "Task A",
          status: "completed",
          jira_key: "PROJ-1",
          tag: "frontend",
          completed_in_pomodoro: 2,
        },
      ],
    },
    {
      jira_key: null,
      tasks: [
        {
          id: 2,
          title: "Task B",
          status: "pending",
          jira_key: null,
          tag: null,
          completed_in_pomodoro: null,
        },
      ],
    },
  ],
  ...overrides,
});

describe("DailySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(makeSummary());
    useReportStore.setState({
      dailyDate: "2026-02-15",
      dailySummary: null,
      isDailyLoading: false,
    });
  });

  it("renders pomodoro count", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("4")).toBeInTheDocument();
    });
    expect(screen.getByText("Pomodoros")).toBeInTheDocument();
  });

  it("renders focus time", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("1h 40m")).toBeInTheDocument();
    });
    expect(screen.getByText("Focus time")).toBeInTheDocument();
  });

  it("renders tasks completed ratio", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("3/5")).toBeInTheDocument();
    });
    expect(screen.getByText("Tasks done")).toBeInTheDocument();
  });

  it("renders interval list with types", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("Focus")).toBeInTheDocument();
    });
    expect(screen.getByText("Short Break")).toBeInTheDocument();
  });

  it("renders task groups by jira key", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("PROJ-1")).toBeInTheDocument();
    });
    expect(screen.getByText("No Jira ticket")).toBeInTheDocument();
    expect(screen.getByText("Task A")).toBeInTheDocument();
    expect(screen.getByText("Task B")).toBeInTheDocument();
  });

  it("renders task tag badge", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("frontend")).toBeInTheDocument();
    });
  });

  it("renders pomodoro indicator on completed task", async () => {
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("Pomodoro 2")).toBeInTheDocument();
    });
  });

  it("shows 'Today' when viewing current date", async () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    mockInvoke.mockResolvedValue(makeSummary({ date: todayStr }));
    useReportStore.setState({ dailyDate: todayStr });
    render(<DailySummary />);
    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("shows Today button when viewing a different date", () => {
    useReportStore.setState({ dailyDate: "2026-01-15" });
    render(<DailySummary />);
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
  });

  it("hides Today button when viewing today", () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    useReportStore.setState({ dailyDate: todayStr });
    render(<DailySummary />);
    expect(
      screen.queryByRole("button", { name: "Today" }),
    ).not.toBeInTheDocument();
  });

  it("navigates to previous day on prev click", async () => {
    const user = userEvent.setup();
    render(<DailySummary />);

    await waitFor(() => {
      expect(screen.getByText("4")).toBeInTheDocument();
    });

    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(makeSummary({ date: "2026-02-14" }));

    const buttons = screen.getAllByRole("button");
    const prevButton = buttons[0];
    await user.click(prevButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_daily_summary", {
        dayDate: "2026-02-14",
      });
    });
  });

  it("shows loading state", () => {
    useReportStore.setState({ isDailyLoading: true, dailySummary: null });
    render(<DailySummary />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty intervals message", async () => {
    mockInvoke.mockResolvedValue(makeSummary({ intervals: [] }));
    render(<DailySummary />);
    await waitFor(() => {
      expect(
        screen.getByText("No completed intervals for this day."),
      ).toBeInTheDocument();
    });
  });

  it("shows empty tasks message", async () => {
    mockInvoke.mockResolvedValue(makeSummary({ task_groups: [] }));
    render(<DailySummary />);
    await waitFor(() => {
      expect(screen.getByText("No tasks for this day.")).toBeInTheDocument();
    });
  });
});
