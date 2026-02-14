import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("@/lib/settingsRepository", () => ({
  getAll: vi.fn(async () => []),
}));

const { useTaskStore } = await import("@/stores/taskStore");
const { DateNavigator } = await import("../DateNavigator");

describe("DateNavigator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue([]);
  });

  it("renders 'Today' when selected date is today", () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    useTaskStore.setState({ selectedDate: todayStr });
    render(<DateNavigator />);

    expect(screen.getByTestId("date-header-text")).toHaveTextContent("Today");
  });

  it("renders formatted date for a non-today date", () => {
    useTaskStore.setState({ selectedDate: "2026-01-15" });
    render(<DateNavigator />);

    const headerText = screen.getByTestId("date-header-text").textContent;
    // Should contain "Jan" and "15" and "2026"
    expect(headerText).toContain("Jan");
    expect(headerText).toContain("15");
    expect(headerText).toContain("2026");
  });

  it("does not show 'Today' button when viewing today", () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    useTaskStore.setState({ selectedDate: todayStr });
    render(<DateNavigator />);

    expect(screen.queryByTestId("date-today-button")).not.toBeInTheDocument();
  });

  it("shows 'Today' button when viewing a different date", () => {
    useTaskStore.setState({ selectedDate: "2026-01-10" });
    render(<DateNavigator />);

    expect(screen.getByTestId("date-today-button")).toBeInTheDocument();
  });

  it("shows past-day indicator when viewing a past date", () => {
    useTaskStore.setState({ selectedDate: "2020-01-01" });
    render(<DateNavigator />);

    expect(screen.getByTestId("past-day-indicator")).toBeInTheDocument();
    expect(screen.getByTestId("past-day-indicator")).toHaveTextContent(
      "Viewing a past day",
    );
  });

  it("does not show past-day indicator for today", () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    useTaskStore.setState({ selectedDate: todayStr });
    render(<DateNavigator />);

    expect(screen.queryByTestId("past-day-indicator")).not.toBeInTheDocument();
  });

  it("navigates to previous day when clicking prev button", async () => {
    const user = userEvent.setup();
    useTaskStore.setState({ selectedDate: "2026-02-14" });
    render(<DateNavigator />);

    await user.click(screen.getByTestId("date-prev"));

    expect(useTaskStore.getState().selectedDate).toBe("2026-02-13");
    expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
      dayDate: "2026-02-13",
    });
  });

  it("navigates to next day when clicking next button", async () => {
    const user = userEvent.setup();
    useTaskStore.setState({ selectedDate: "2026-02-14" });
    render(<DateNavigator />);

    await user.click(screen.getByTestId("date-next"));

    expect(useTaskStore.getState().selectedDate).toBe("2026-02-15");
    expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
      dayDate: "2026-02-15",
    });
  });

  it("navigates back to today when clicking Today button", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    useTaskStore.setState({ selectedDate: "2026-01-01" });
    render(<DateNavigator />);

    await user.click(screen.getByTestId("date-today-button"));

    expect(useTaskStore.getState().selectedDate).toBe(todayStr);
    expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
      dayDate: todayStr,
    });
  });

  it("opens calendar popover when clicking the date header", async () => {
    const user = userEvent.setup();
    useTaskStore.setState({ selectedDate: "2026-02-14" });
    render(<DateNavigator />);

    await user.click(screen.getByTestId("date-header-button"));

    // Calendar should be visible (react-day-picker renders a calendar element)
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("selects a date from the calendar and closes popover", async () => {
    const user = userEvent.setup();
    useTaskStore.setState({ selectedDate: "2026-02-14" });
    render(<DateNavigator />);

    // Open calendar
    await user.click(screen.getByTestId("date-header-button"));

    // Click on day 10 — the button is inside the gridcell
    const day10Cell = screen.getByRole("gridcell", { name: "10" });
    const day10Button = day10Cell.querySelector("button") as HTMLButtonElement;
    expect(day10Button).not.toBeNull();
    await user.click(day10Button);

    expect(useTaskStore.getState().selectedDate).toBe("2026-02-10");
    expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
      dayDate: "2026-02-10",
    });
  });
});
