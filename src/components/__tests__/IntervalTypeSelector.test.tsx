import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
const { IntervalTypeSelector } = await import("../IntervalTypeSelector");

describe("IntervalTypeSelector", () => {
  beforeEach(() => {
    useTimerStore.setState({
      state: "idle",
      selectedType: "work",
      workDuration: 1500,
      shortBreakDuration: 300,
      longBreakDuration: 900,
    });
  });

  it("renders all three interval type options", () => {
    render(<IntervalTypeSelector />);
    expect(screen.getByTestId("type-work")).toBeInTheDocument();
    expect(screen.getByTestId("type-short_break")).toBeInTheDocument();
    expect(screen.getByTestId("type-long_break")).toBeInTheDocument();
  });

  it("displays duration labels for each type", () => {
    render(<IntervalTypeSelector />);
    expect(screen.getByText("25 min")).toBeInTheDocument();
    expect(screen.getByText("5 min")).toBeInTheDocument();
    expect(screen.getByText("15 min")).toBeInTheDocument();
  });

  it("shows Focus, Short Break, and Long Break labels", () => {
    render(<IntervalTypeSelector />);
    expect(screen.getByText("Focus")).toBeInTheDocument();
    expect(screen.getByText("Short Break")).toBeInTheDocument();
    expect(screen.getByText("Long Break")).toBeInTheDocument();
  });

  it("changes selected type on click", async () => {
    const user = userEvent.setup();
    render(<IntervalTypeSelector />);

    await user.click(screen.getByTestId("type-short_break"));

    expect(useTimerStore.getState().selectedType).toBe("short_break");
  });

  it("has work selected by default", () => {
    render(<IntervalTypeSelector />);
    const workRadio = screen
      .getByTestId("type-work")
      .querySelector("input[type='radio']");
    expect(workRadio).toBeChecked();
  });

  it("disables options when timer is running", () => {
    useTimerStore.setState({ state: "running" });

    render(<IntervalTypeSelector />);
    const radios = screen.getAllByRole("radio");
    for (const radio of radios) {
      expect(radio).toBeDisabled();
    }
  });

  it("does not change type when timer is running", async () => {
    useTimerStore.setState({ state: "running", selectedType: "work" });

    const user = userEvent.setup();
    render(<IntervalTypeSelector />);

    await user.click(screen.getByTestId("type-short_break"));

    expect(useTimerStore.getState().selectedType).toBe("work");
  });
});
