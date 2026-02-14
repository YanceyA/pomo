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

const { useTimerStore } = await import("@/stores/timerStore");
const { TimerControls } = await import("../TimerControls");

describe("TimerControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      state: "idle",
      intervalType: "work",
      remainingMs: 0,
      plannedDurationSeconds: 0,
      intervalId: null,
      completedWorkCount: 0,
      selectedType: "work",
      workDuration: 1500,
      shortBreakDuration: 300,
      longBreakDuration: 900,
    });
  });

  it("shows Start button when idle", () => {
    render(<TimerControls />);
    expect(screen.getByTestId("start-button")).toBeInTheDocument();
    expect(screen.getByText("Start")).toBeInTheDocument();
  });

  it("does not show Pause or Cancel when idle", () => {
    render(<TimerControls />);
    expect(screen.queryByTestId("pause-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-button")).not.toBeInTheDocument();
  });

  it("calls start_timer with correct params on Start click", async () => {
    mockInvoke.mockResolvedValue({
      state: "running",
      interval_type: "work",
      remaining_ms: 1500000,
      planned_duration_seconds: 1500,
      interval_id: 1,
      completed_work_count: 0,
    });

    const user = userEvent.setup();
    render(<TimerControls />);
    await user.click(screen.getByTestId("start-button"));

    expect(mockInvoke).toHaveBeenCalledWith("start_timer", {
      intervalType: "work",
      durationSeconds: 1500,
    });
  });

  it("shows Pause and Cancel when running", () => {
    useTimerStore.setState({ state: "running" });

    render(<TimerControls />);
    expect(screen.getByTestId("pause-button")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
    expect(screen.queryByTestId("start-button")).not.toBeInTheDocument();
  });

  it("shows Resume and Cancel when paused", () => {
    useTimerStore.setState({ state: "paused" });

    render(<TimerControls />);
    expect(screen.getByTestId("resume-button")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-button")).toBeInTheDocument();
  });

  it("calls pause_timer on Pause click", async () => {
    useTimerStore.setState({ state: "running" });
    mockInvoke.mockResolvedValue({
      state: "paused",
      interval_type: "work",
      remaining_ms: 900000,
      planned_duration_seconds: 1500,
      interval_id: 1,
      completed_work_count: 0,
    });

    const user = userEvent.setup();
    render(<TimerControls />);
    await user.click(screen.getByTestId("pause-button"));

    expect(mockInvoke).toHaveBeenCalledWith("pause_timer");
  });

  it("calls resume_timer on Resume click", async () => {
    useTimerStore.setState({ state: "paused" });
    mockInvoke.mockResolvedValue({
      state: "running",
      interval_type: "work",
      remaining_ms: 900000,
      planned_duration_seconds: 1500,
      interval_id: 1,
      completed_work_count: 0,
    });

    const user = userEvent.setup();
    render(<TimerControls />);
    await user.click(screen.getByTestId("resume-button"));

    expect(mockInvoke).toHaveBeenCalledWith("resume_timer");
  });

  it("calls cancel_timer on Cancel click", async () => {
    useTimerStore.setState({ state: "running" });
    mockInvoke.mockResolvedValue({
      state: "idle",
      interval_type: "work",
      remaining_ms: 0,
      planned_duration_seconds: 0,
      interval_id: null,
      completed_work_count: 0,
    });

    const user = userEvent.setup();
    render(<TimerControls />);
    await user.click(screen.getByTestId("cancel-button"));

    expect(mockInvoke).toHaveBeenCalledWith("cancel_timer");
  });

  it("shows Stop button during overtime", () => {
    useTimerStore.setState({ state: "running", overtime: true });

    render(<TimerControls />);
    expect(screen.getByTestId("stop-button")).toBeInTheDocument();
    expect(screen.getByText("Stop")).toBeInTheDocument();
    expect(screen.queryByTestId("pause-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cancel-button")).not.toBeInTheDocument();
  });

  it("Stop button calls cancelTimer during overtime", async () => {
    useTimerStore.setState({ state: "running", overtime: true });
    mockInvoke.mockResolvedValue({
      state: "idle",
      interval_type: "short_break",
      remaining_ms: 0,
      planned_duration_seconds: 0,
      interval_id: null,
      completed_work_count: 0,
      overtime: false,
      overtime_ms: 0,
    });

    const user = userEvent.setup();
    render(<TimerControls />);
    await user.click(screen.getByTestId("stop-button"));

    expect(mockInvoke).toHaveBeenCalledWith("cancel_timer");
  });
});
