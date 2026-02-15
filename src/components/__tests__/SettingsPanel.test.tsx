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

const mockDialogOpen = vi.fn();
vi.mock("@tauri-apps/plugin-dialog", () => ({
  default: { open: (...args: unknown[]) => mockDialogOpen(...args) },
  open: (...args: unknown[]) => mockDialogOpen(...args),
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

const defaultDbInfo = {
  path: "C:\\Users\\user\\AppData\\Roaming\\com.pomo.app\\pomo.db",
  is_custom: false,
  is_cloud_synced: false,
  journal_mode: "WAL",
  default_path: "C:\\Users\\user\\AppData\\Roaming\\com.pomo.app\\pomo.db",
  is_portable: false,
};

describe("SettingsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue(defaultSettings);
    mockSet.mockResolvedValue(undefined);
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_db_info") return Promise.resolve(defaultDbInfo);
      return Promise.resolve(undefined);
    });
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

  // ── Database Location tests ────────────────────────────────

  it("renders database location section", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-section")).toBeInTheDocument();
    });
    expect(screen.getByText("Database Location")).toBeInTheDocument();
  });

  it("displays current database path", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-path")).toHaveTextContent(
        "C:\\Users\\user\\AppData\\Roaming\\com.pomo.app\\pomo.db",
      );
    });
  });

  it("shows local journal mode for non-cloud path", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-local")).toHaveTextContent(
        "Local (journal_mode=WAL)",
      );
    });
  });

  it("shows cloud-synced indicator for cloud path", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_db_info")
        return Promise.resolve({
          ...defaultDbInfo,
          path: "C:\\Users\\user\\OneDrive\\pomo.db",
          is_cloud_synced: true,
          journal_mode: "DELETE",
          is_custom: true,
        });
      return Promise.resolve(undefined);
    });

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-cloud")).toHaveTextContent(
        "Cloud-synced (journal_mode=DELETE)",
      );
    });
  });

  it("renders change button", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-change")).toBeInTheDocument();
    });
    expect(screen.getByTestId("settings-db-change")).toHaveTextContent(
      "Change...",
    );
  });

  it("shows reset button only when using custom path", async () => {
    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-change")).toBeInTheDocument();
    });
    // Default path — no reset button
    expect(screen.queryByTestId("settings-db-reset")).not.toBeInTheDocument();
  });

  it("shows reset button when custom path is set", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_db_info")
        return Promise.resolve({ ...defaultDbInfo, is_custom: true });
      return Promise.resolve(undefined);
    });

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-reset")).toBeInTheDocument();
    });
    expect(screen.getByTestId("settings-db-reset")).toHaveTextContent(
      "Reset to Default",
    );
  });

  it("change button opens folder dialog and calls change_db_path", async () => {
    const newDbInfo = {
      ...defaultDbInfo,
      path: "D:\\Data\\pomo.db",
      is_custom: true,
    };
    mockDialogOpen.mockResolvedValue("D:\\Data");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_db_info") return Promise.resolve(defaultDbInfo);
      if (cmd === "change_db_path") return Promise.resolve(newDbInfo);
      return Promise.resolve(undefined);
    });

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-db-change")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-db-change"));

    await waitFor(() => {
      expect(mockDialogOpen).toHaveBeenCalledWith({
        title: "Select Database Folder",
        directory: true,
      });
    });
    expect(mockInvoke).toHaveBeenCalledWith("change_db_path", {
      newDirectory: "D:\\Data",
    });
  });

  it("shows restart message after path change", async () => {
    const newDbInfo = {
      ...defaultDbInfo,
      path: "D:\\Data\\pomo.db",
      is_custom: true,
    };
    mockDialogOpen.mockResolvedValue("D:\\Data");
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_db_info") return Promise.resolve(defaultDbInfo);
      if (cmd === "change_db_path") return Promise.resolve(newDbInfo);
      return Promise.resolve(undefined);
    });

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-db-change")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-db-change"));

    await waitFor(() => {
      expect(screen.getByTestId("settings-db-restart")).toHaveTextContent(
        "Restart the app for the new database location to take effect.",
      );
    });
  });

  it("reset button calls reset_db_path and shows restart message", async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_db_info")
        return Promise.resolve({ ...defaultDbInfo, is_custom: true });
      if (cmd === "reset_db_path") return Promise.resolve(defaultDbInfo);
      return Promise.resolve(undefined);
    });

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-db-reset")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-db-reset"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("reset_db_path");
    });
    await waitFor(() => {
      expect(screen.getByTestId("settings-db-restart")).toBeInTheDocument();
    });
  });

  it("does not call change_db_path when dialog is cancelled", async () => {
    mockDialogOpen.mockResolvedValue(null);

    const user = userEvent.setup();
    render(<SettingsPanel />);

    await user.click(screen.getByTestId("settings-trigger"));
    await waitFor(() => {
      expect(screen.getByTestId("settings-db-change")).toBeInTheDocument();
    });

    await user.click(screen.getByTestId("settings-db-change"));

    await waitFor(() => {
      expect(mockDialogOpen).toHaveBeenCalled();
    });
    expect(mockInvoke).not.toHaveBeenCalledWith(
      "change_db_path",
      expect.anything(),
    );
  });
});
