import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WeeklySummary as WeeklySummaryType } from "@/lib/schemas";

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
const { WeeklySummary } = await import("../WeeklySummary");

const makeSummary = (overrides = {}): WeeklySummaryType => ({
  week_start: "2026-02-10",
  week_end: "2026-02-16",
  daily_stats: [
    {
      date: "2026-02-10",
      pomodoro_count: 3,
      focus_minutes: 75,
      tasks_completed: 2,
    },
    {
      date: "2026-02-11",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
    {
      date: "2026-02-12",
      pomodoro_count: 2,
      focus_minutes: 50,
      tasks_completed: 1,
    },
    {
      date: "2026-02-13",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
    {
      date: "2026-02-14",
      pomodoro_count: 4,
      focus_minutes: 100,
      tasks_completed: 3,
    },
    {
      date: "2026-02-15",
      pomodoro_count: 1,
      focus_minutes: 25,
      tasks_completed: 1,
    },
    {
      date: "2026-02-16",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
  ],
  total_pomodoros: 10,
  total_focus_minutes: 250,
  total_tasks_completed: 7,
  task_groups: [
    {
      jira_key: "PROJ-1",
      tasks: [
        {
          id: 1,
          title: "Weekly Task A",
          status: "completed",
          jira_key: "PROJ-1",
          tag: null,
          completed_in_pomodoro: 1,
        },
        {
          id: 2,
          title: "Weekly Task B",
          status: "completed",
          jira_key: "PROJ-1",
          tag: null,
          completed_in_pomodoro: 3,
        },
      ],
    },
    {
      jira_key: null,
      tasks: [
        {
          id: 3,
          title: "Unlinked Task",
          status: "pending",
          jira_key: null,
          tag: "misc",
          completed_in_pomodoro: null,
        },
      ],
    },
  ],
  ...overrides,
});

describe("WeeklySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(makeSummary());
    useReportStore.setState({
      weekStart: "2026-02-10",
      weeklySummary: null,
      isWeeklyLoading: false,
    });
  });

  it("renders total pomodoro count", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
    expect(screen.getByText("Pomodoros")).toBeInTheDocument();
  });

  it("renders total focus time", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("4h 10m")).toBeInTheDocument();
    });
    expect(screen.getByText("Focus time")).toBeInTheDocument();
  });

  it("renders total tasks completed", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
    expect(screen.getByText("Tasks done")).toBeInTheDocument();
  });

  it("renders bar chart", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-bar-chart")).toBeInTheDocument();
    });
  });

  it("renders daily breakdown rows", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("Pomodoros per day")).toBeInTheDocument();
    });
    expect(screen.getByText("Daily breakdown")).toBeInTheDocument();
  });

  it("renders task groups by jira key", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("PROJ-1")).toBeInTheDocument();
    });
    expect(screen.getByText("No Jira ticket")).toBeInTheDocument();
    expect(screen.getByText("Weekly Task A")).toBeInTheDocument();
    expect(screen.getByText("Weekly Task B")).toBeInTheDocument();
    expect(screen.getByText("Unlinked Task")).toBeInTheDocument();
  });

  it("renders task tag badge", async () => {
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("misc")).toBeInTheDocument();
    });
  });

  it("navigates to previous week on prev click", async () => {
    const user = userEvent.setup();
    render(<WeeklySummary />);

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    // Clear earlier invocations from initial load
    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(makeSummary());

    const buttons = screen.getAllByRole("button");
    const prevButton = buttons[0];
    await user.click(prevButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_weekly_summary", {
        weekStart: "2026-02-03",
      });
    });
  });

  it("shows loading state", () => {
    useReportStore.setState({
      isWeeklyLoading: true,
      weeklySummary: null,
    });
    render(<WeeklySummary />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows empty task groups message", async () => {
    mockInvoke.mockResolvedValue(makeSummary({ task_groups: [] }));
    render(<WeeklySummary />);
    await waitFor(() => {
      expect(screen.getByText("No tasks for this week.")).toBeInTheDocument();
    });
  });

  it("shows This Week button when viewing a past week", () => {
    useReportStore.setState({ weekStart: "2026-01-06" });
    render(<WeeklySummary />);
    expect(
      screen.getByRole("button", { name: "This Week" }),
    ).toBeInTheDocument();
  });
});
