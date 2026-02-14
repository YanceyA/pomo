import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

const mockGetAll = vi.fn();
const mockSet = vi.fn();
vi.mock("@/lib/settingsRepository", () => ({
  getAll: (...args: unknown[]) => mockGetAll(...args),
  set: (...args: unknown[]) => mockSet(...args),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

vi.mock("@/lib/audio", () => ({
  playAlarmChime: vi.fn(async () => {}),
}));

const { useTimerStore } = await import("@/stores/timerStore");
const { SettingsPanel } = await import("../SettingsPanel");

const defaultSettings = [
  {
    key: "work_duration_minutes",
    value: "25",
    type: "integer",
    updated_at: "2026-02-14T10:00:00Z",
  },
  {
    key: "short_break_duration_minutes",
    value: "5",
    type: "integer",
    updated_at: "2026-02-14T10:00:00Z",
  },
  {
    key: "long_break_duration_minutes",
    value: "15",
    type: "integer",
    updated_at: "2026-02-14T10:00:00Z",
  },
  {
    key: "long_break_frequency",
    value: "4",
    type: "integer",
    updated_at: "2026-02-14T10:00:00Z",
  },
];

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(defaultSettings);
    mockSet.mockResolvedValue(undefined);
    useTimerStore.setState({
      state: "idle",
      intervalType: "work",
      remainingMs: 0,
      plannedDurationSeconds: 0,
      intervalId: null,
      completedWorkCount: 0,
      workDuration: 1500,
      shortBreakDuration: 300,
      longBreakDuration: 900,
      longBreakFrequency: 4,
      showCompletionNotice: false,
      completedIntervalType: null,
      showAssociationDialog: false,
      lastCompletedIntervalId: null,
      selectedType: "work",
    });
  });

  it("renders the settings trigger button", () => {
    render(<SettingsPanel />);
    expect(screen.getByTestId("settings-trigger")).toBeInTheDocument();
  });

  it("opens the settings panel when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    });
  });

  it("loads and displays current settings values", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-work-duration")).toHaveValue(25);
    });
    expect(screen.getByTestId("settings-short-break")).toHaveValue(5);
    expect(screen.getByTestId("settings-long-break")).toHaveValue(15);
    expect(screen.getByTestId("settings-frequency")).toHaveValue(4);
  });

  it("saves settings to the repository when save is clicked", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-work-duration")).toHaveValue(25);
    });

    // Clear and type new value
    const workInput = screen.getByTestId("settings-work-duration");
    await user.clear(workInput);
    await user.type(workInput, "30");

    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("work_duration_minutes", "30");
    });
    expect(mockSet).toHaveBeenCalledWith("short_break_duration_minutes", "5");
    expect(mockSet).toHaveBeenCalledWith("long_break_duration_minutes", "15");
    expect(mockSet).toHaveBeenCalledWith("long_break_frequency", "4");
  });

  it("reloads timer settings after save", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-work-duration")).toHaveValue(25);
    });

    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => {
      // loadSettings calls getAll
      expect(mockGetAll).toHaveBeenCalledTimes(2); // once on open, once on save (loadSettings)
    });
  });

  it("applies 25/5 preset", async () => {
    mockGetAll.mockResolvedValue([
      {
        key: "work_duration_minutes",
        value: "35",
        type: "integer",
        updated_at: "2026-02-14T10:00:00Z",
      },
      {
        key: "short_break_duration_minutes",
        value: "7",
        type: "integer",
        updated_at: "2026-02-14T10:00:00Z",
      },
      {
        key: "long_break_duration_minutes",
        value: "21",
        type: "integer",
        updated_at: "2026-02-14T10:00:00Z",
      },
      {
        key: "long_break_frequency",
        value: "4",
        type: "integer",
        updated_at: "2026-02-14T10:00:00Z",
      },
    ]);

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-work-duration")).toHaveValue(35);
    });

    await user.click(screen.getByTestId("settings-preset-25-5"));

    expect(screen.getByTestId("settings-work-duration")).toHaveValue(25);
    expect(screen.getByTestId("settings-short-break")).toHaveValue(5);
    expect(screen.getByTestId("settings-long-break")).toHaveValue(15);
  });

  it("applies 35/7 preset", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-work-duration")).toHaveValue(25);
    });

    await user.click(screen.getByTestId("settings-preset-35-7"));

    expect(screen.getByTestId("settings-work-duration")).toHaveValue(35);
    expect(screen.getByTestId("settings-short-break")).toHaveValue(7);
    expect(screen.getByTestId("settings-long-break")).toHaveValue(21);
  });

  it("shows timer warning when timer is active", async () => {
    useTimerStore.setState({ state: "running" });
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-timer-warning")).toBeInTheDocument();
    });
  });

  it("does not show timer warning when timer is idle", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId("settings-timer-warning"),
    ).not.toBeInTheDocument();
  });

  it("closes the sheet after successful save", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => {
      expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
    });
  });

  it("renders break overtime checkbox", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-break-overtime")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Show overtime on break timers"),
    ).toBeInTheDocument();
  });

  it("saves break overtime setting", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-break-overtime")).toBeInTheDocument();
    });

    // Toggle the checkbox
    await user.click(screen.getByTestId("settings-break-overtime"));
    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("break_overtime_enabled", "true");
    });
  });

  it("renders alarm volume slider", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByText("Alarm volume")).toBeInTheDocument();
    });
    expect(screen.getByTestId("settings-volume-value")).toBeInTheDocument();
  });

  it("displays volume percentage", async () => {
    mockGetAll.mockResolvedValue([
      ...defaultSettings,
      {
        key: "alarm_volume",
        value: "0.8",
        type: "real",
        updated_at: "2026-02-14T10:00:00Z",
      },
    ]);

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-volume-value")).toHaveTextContent(
        "80%",
      );
    });
  });

  it("renders test alarm button", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-test-alarm")).toBeInTheDocument();
    });
    expect(screen.getByTestId("settings-test-alarm")).toHaveTextContent("Test");
  });

  it("test button calls playAlarmChime", async () => {
    const { playAlarmChime } = await import("@/lib/audio");
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-test-alarm")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-test-alarm"));

    expect(playAlarmChime).toHaveBeenCalledWith(0.6, 1);
  });

  it("saves alarm volume setting", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-panel")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => {
      expect(mockSet).toHaveBeenCalledWith("alarm_volume", "0.6");
    });
  });
});
