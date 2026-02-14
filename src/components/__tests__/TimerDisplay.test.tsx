import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("@/lib/settingsRepository", () => ({
  getAll: vi.fn(async () => []),
}));

const { useTimerStore } = await import("@/stores/timerStore");
const { TimerDisplay } = await import("../TimerDisplay");

describe("TimerDisplay", () => {
  beforeEach(() => {
    useTimerStore.setState({
      state: "idle",
      intervalType: "work",
      remainingMs: 0,
      plannedDurationSeconds: 0,
      selectedType: "work",
      workDuration: 1500,
      shortBreakDuration: 300,
      longBreakDuration: 900,
    });
  });

  it("renders the timer display", () => {
    render(<TimerDisplay />);
    expect(screen.getByTestId("timer-display")).toBeInTheDocument();
  });

  it("shows default work duration when idle", () => {
    render(<TimerDisplay />);
    // 1500 seconds = 25:00
    expect(screen.getByText("25:00")).toBeInTheDocument();
  });

  it("shows Focus label when work is selected", () => {
    render(<TimerDisplay />);
    expect(screen.getByText("Focus")).toBeInTheDocument();
  });

  it("shows remaining time when running", () => {
    useTimerStore.setState({
      state: "running",
      intervalType: "work",
      remainingMs: 600000, // 10 minutes
      plannedDurationSeconds: 1500,
    });

    render(<TimerDisplay />);
    expect(screen.getByText("10:00")).toBeInTheDocument();
  });

  it("shows short break duration when short break selected", () => {
    useTimerStore.setState({ selectedType: "short_break" });

    render(<TimerDisplay />);
    // 300 seconds = 5:00
    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.getByText("Short Break")).toBeInTheDocument();
  });

  it("shows long break duration when long break selected", () => {
    useTimerStore.setState({ selectedType: "long_break" });

    render(<TimerDisplay />);
    // 900 seconds = 15:00
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByText("Long Break")).toBeInTheDocument();
  });

  it("shows interval type label during active timer", () => {
    useTimerStore.setState({
      state: "running",
      intervalType: "short_break",
      remainingMs: 120000,
      plannedDurationSeconds: 300,
    });

    render(<TimerDisplay />);
    expect(screen.getByText("Short Break")).toBeInTheDocument();
  });

  it("formats time with leading zeros", () => {
    useTimerStore.setState({
      state: "running",
      intervalType: "work",
      remainingMs: 65000, // 1:05
      plannedDurationSeconds: 1500,
    });

    render(<TimerDisplay />);
    expect(screen.getByText("01:05")).toBeInTheDocument();
  });
});
