import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonthlySummary as MonthlySummaryType } from "@/lib/schemas";

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

vi.mock("chartjs-adapter-date-fns", () => ({}));

const { useReportStore } = await import("@/stores/reportStore");
const { MonthlySummary } = await import("../MonthlySummary");

const makeSummary = (overrides = {}): MonthlySummaryType => ({
  month_start: "2026-02-01",
  month_end: "2026-02-28",
  weekly_stats: [
    {
      week_start: "2026-01-26",
      week_end: "2026-02-01",
      pomodoro_count: 2,
      focus_minutes: 50,
      tasks_completed: 1,
    },
    {
      week_start: "2026-02-02",
      week_end: "2026-02-08",
      pomodoro_count: 5,
      focus_minutes: 125,
      tasks_completed: 3,
    },
    {
      week_start: "2026-02-09",
      week_end: "2026-02-15",
      pomodoro_count: 4,
      focus_minutes: 100,
      tasks_completed: 2,
    },
    {
      week_start: "2026-02-16",
      week_end: "2026-02-22",
      pomodoro_count: 3,
      focus_minutes: 75,
      tasks_completed: 2,
    },
    {
      week_start: "2026-02-23",
      week_end: "2026-03-01",
      pomodoro_count: 1,
      focus_minutes: 25,
      tasks_completed: 1,
    },
  ],
  total_pomodoros: 15,
  total_focus_minutes: 375,
  total_tasks_completed: 9,
  ...overrides,
});

describe("MonthlySummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(makeSummary());
    useReportStore.setState({
      monthStart: "2026-02-01",
      monthlySummary: null,
      isMonthlyLoading: false,
    });
  });

  it("renders total pomodoro count", async () => {
    render(<MonthlySummary />);
    await waitFor(() => {
      expect(screen.getByText("15")).toBeInTheDocument();
    });
    expect(screen.getByText("Pomodoros")).toBeInTheDocument();
  });

  it("renders total focus time", async () => {
    render(<MonthlySummary />);
    await waitFor(() => {
      expect(screen.getByText("6h 15m")).toBeInTheDocument();
    });
    expect(screen.getByText("Focus time")).toBeInTheDocument();
  });

  it("renders total tasks completed", async () => {
    render(<MonthlySummary />);
    await waitFor(() => {
      expect(screen.getByText("9")).toBeInTheDocument();
    });
    expect(screen.getByText("Tasks done")).toBeInTheDocument();
  });

  it("renders bar chart", async () => {
    render(<MonthlySummary />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-bar-chart")).toBeInTheDocument();
    });
  });

  it("renders weekly breakdown section", async () => {
    render(<MonthlySummary />);
    await waitFor(() => {
      expect(screen.getByText("Pomodoros per week")).toBeInTheDocument();
    });
    expect(screen.getByText("Weekly breakdown")).toBeInTheDocument();
  });

  it("navigates to previous month on prev click", async () => {
    const user = userEvent.setup();
    render(<MonthlySummary />);

    await waitFor(() => {
      expect(screen.getByText("15")).toBeInTheDocument();
    });

    mockInvoke.mockClear();
    mockInvoke.mockResolvedValue(makeSummary());

    const buttons = screen.getAllByRole("button");
    const prevButton = buttons[0];
    await user.click(prevButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("get_monthly_summary", {
        monthStart: "2026-01-01",
      });
    });
  });

  it("shows loading state", () => {
    useReportStore.setState({
      isMonthlyLoading: true,
      monthlySummary: null,
    });
    render(<MonthlySummary />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows This Month button when viewing a past month", () => {
    useReportStore.setState({ monthStart: "2025-12-01" });
    render(<MonthlySummary />);
    expect(
      screen.getByRole("button", { name: "This Month" }),
    ).toBeInTheDocument();
  });
});
