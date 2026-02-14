import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DailySummary, WeeklySummary } from "@/lib/schemas";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

const { useReportStore } = await import("../reportStore");

const makeDailySummary = (overrides = {}): DailySummary => ({
  date: "2026-02-15",
  pomodoro_count: 4,
  total_focus_minutes: 100,
  tasks_completed: 3,
  tasks_total: 5,
  intervals: [],
  task_groups: [],
  ...overrides,
});

const makeWeeklySummary = (overrides = {}): WeeklySummary => ({
  week_start: "2026-02-10",
  week_end: "2026-02-16",
  daily_stats: [
    {
      date: "2026-02-10",
      pomodoro_count: 2,
      focus_minutes: 50,
      tasks_completed: 1,
    },
    {
      date: "2026-02-11",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
    {
      date: "2026-02-12",
      pomodoro_count: 3,
      focus_minutes: 75,
      tasks_completed: 2,
    },
    {
      date: "2026-02-13",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
    {
      date: "2026-02-14",
      pomodoro_count: 1,
      focus_minutes: 25,
      tasks_completed: 1,
    },
    {
      date: "2026-02-15",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
    {
      date: "2026-02-16",
      pomodoro_count: 0,
      focus_minutes: 0,
      tasks_completed: 0,
    },
  ],
  total_pomodoros: 6,
  total_focus_minutes: 150,
  total_tasks_completed: 4,
  task_groups: [],
  ...overrides,
});

describe("reportStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReportStore.setState({
      activeTab: "daily",
      dailySummary: null,
      isDailyLoading: false,
      weeklySummary: null,
      isWeeklyLoading: false,
    });
  });

  // ── Tab switching ──────────────────────────────────────

  it("defaults to daily tab", () => {
    expect(useReportStore.getState().activeTab).toBe("daily");
  });

  it("setActiveTab changes active tab", () => {
    useReportStore.getState().setActiveTab("weekly");
    expect(useReportStore.getState().activeTab).toBe("weekly");
  });

  // ── Daily summary ─────────────────────────────────────

  it("loadDailySummary calls get_daily_summary with correct date", async () => {
    const summary = makeDailySummary();
    mockInvoke.mockResolvedValueOnce(summary);
    useReportStore.setState({ dailyDate: "2026-02-15" });

    await useReportStore.getState().loadDailySummary();

    expect(mockInvoke).toHaveBeenCalledWith("get_daily_summary", {
      dayDate: "2026-02-15",
    });
    expect(useReportStore.getState().dailySummary).toEqual(summary);
    expect(useReportStore.getState().isDailyLoading).toBe(false);
  });

  it("loadDailySummary accepts explicit date parameter", async () => {
    const summary = makeDailySummary({ date: "2026-02-14" });
    mockInvoke.mockResolvedValueOnce(summary);

    await useReportStore.getState().loadDailySummary("2026-02-14");

    expect(mockInvoke).toHaveBeenCalledWith("get_daily_summary", {
      dayDate: "2026-02-14",
    });
    expect(useReportStore.getState().dailyDate).toBe("2026-02-14");
  });

  it("setDailyDate updates date and loads summary", async () => {
    const summary = makeDailySummary({ date: "2026-02-13" });
    mockInvoke.mockResolvedValueOnce(summary);

    await useReportStore.getState().setDailyDate("2026-02-13");

    expect(useReportStore.getState().dailyDate).toBe("2026-02-13");
    expect(mockInvoke).toHaveBeenCalledWith("get_daily_summary", {
      dayDate: "2026-02-13",
    });
  });

  it("prevDay navigates to previous day", async () => {
    useReportStore.setState({ dailyDate: "2026-02-15" });
    mockInvoke.mockResolvedValueOnce(makeDailySummary({ date: "2026-02-14" }));

    await useReportStore.getState().prevDay();

    expect(useReportStore.getState().dailyDate).toBe("2026-02-14");
  });

  it("nextDay navigates to next day", async () => {
    useReportStore.setState({ dailyDate: "2026-02-15" });
    mockInvoke.mockResolvedValueOnce(makeDailySummary({ date: "2026-02-16" }));

    await useReportStore.getState().nextDay();

    expect(useReportStore.getState().dailyDate).toBe("2026-02-16");
  });

  it("loadDailySummary sets isDailyLoading to false on error", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("DB error"));

    await useReportStore.getState().loadDailySummary();

    expect(useReportStore.getState().isDailyLoading).toBe(false);
  });

  // ── Weekly summary ────────────────────────────────────

  it("loadWeeklySummary calls get_weekly_summary with correct week start", async () => {
    const summary = makeWeeklySummary();
    mockInvoke.mockResolvedValueOnce(summary);
    useReportStore.setState({ weekStart: "2026-02-10" });

    await useReportStore.getState().loadWeeklySummary();

    expect(mockInvoke).toHaveBeenCalledWith("get_weekly_summary", {
      weekStart: "2026-02-10",
    });
    expect(useReportStore.getState().weeklySummary).toEqual(summary);
    expect(useReportStore.getState().isWeeklyLoading).toBe(false);
  });

  it("prevWeek moves back 7 days", async () => {
    useReportStore.setState({ weekStart: "2026-02-10" });
    mockInvoke.mockResolvedValueOnce(makeWeeklySummary());

    await useReportStore.getState().prevWeek();

    expect(useReportStore.getState().weekStart).toBe("2026-02-03");
  });

  it("nextWeek moves forward 7 days", async () => {
    useReportStore.setState({ weekStart: "2026-02-10" });
    mockInvoke.mockResolvedValueOnce(makeWeeklySummary());

    await useReportStore.getState().nextWeek();

    expect(useReportStore.getState().weekStart).toBe("2026-02-17");
  });

  it("loadWeeklySummary sets isWeeklyLoading to false on error", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("DB error"));

    await useReportStore.getState().loadWeeklySummary();

    expect(useReportStore.getState().isWeeklyLoading).toBe(false);
  });
});
