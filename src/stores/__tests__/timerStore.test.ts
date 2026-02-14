import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";

// ── Mock Tauri APIs ────────────────────────────────────────

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

type ListenerCallback = (event: { payload: unknown }) => void;
const listeners = new Map<string, ListenerCallback>();
const mockUnlisten = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, callback: ListenerCallback) => {
    listeners.set(event, callback);
    return mockUnlisten;
  }),
}));

vi.mock("@/lib/settingsRepository", () => ({
  getAll: vi.fn(async () => []),
}));

const { useTimerStore } = await import("../timerStore");

describe("timerStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listeners.clear();
    // Reset store to initial state
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
      selectedType: "work",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startTimer", () => {
    it("calls invoke with correct command and params", async () => {
      mockInvoke.mockResolvedValue({
        state: "running",
        interval_type: "work",
        remaining_ms: 1500000,
        planned_duration_seconds: 1500,
        interval_id: 1,
        completed_work_count: 0,
      });

      await useTimerStore.getState().startTimer();

      expect(mockInvoke).toHaveBeenCalledWith("start_timer", {
        intervalType: "work",
        durationSeconds: 1500,
      });
    });

    it("updates store state after successful start", async () => {
      mockInvoke.mockResolvedValue({
        state: "running",
        interval_type: "work",
        remaining_ms: 1500000,
        planned_duration_seconds: 1500,
        interval_id: 1,
        completed_work_count: 0,
      });

      await useTimerStore.getState().startTimer();

      const state = useTimerStore.getState();
      expect(state.state).toBe("running");
      expect(state.remainingMs).toBe(1500000);
      expect(state.plannedDurationSeconds).toBe(1500);
      expect(state.intervalId).toBe(1);
    });

    it("uses short break duration when selected", async () => {
      useTimerStore.setState({ selectedType: "short_break" });
      mockInvoke.mockResolvedValue({
        state: "running",
        interval_type: "short_break",
        remaining_ms: 300000,
        planned_duration_seconds: 300,
        interval_id: 2,
        completed_work_count: 0,
      });

      await useTimerStore.getState().startTimer();

      expect(mockInvoke).toHaveBeenCalledWith("start_timer", {
        intervalType: "short_break",
        durationSeconds: 300,
      });
    });
  });

  describe("pauseTimer", () => {
    it("calls invoke and updates state to paused", async () => {
      mockInvoke.mockResolvedValue({
        state: "paused",
        interval_type: "work",
        remaining_ms: 900000,
        planned_duration_seconds: 1500,
        interval_id: 1,
        completed_work_count: 0,
      });

      await useTimerStore.getState().pauseTimer();

      expect(mockInvoke).toHaveBeenCalledWith("pause_timer");
      expect(useTimerStore.getState().state).toBe("paused");
      expect(useTimerStore.getState().remainingMs).toBe(900000);
    });
  });

  describe("resumeTimer", () => {
    it("calls invoke and updates state to running", async () => {
      mockInvoke.mockResolvedValue({
        state: "running",
        interval_type: "work",
        remaining_ms: 900000,
        planned_duration_seconds: 1500,
        interval_id: 1,
        completed_work_count: 0,
      });

      await useTimerStore.getState().resumeTimer();

      expect(mockInvoke).toHaveBeenCalledWith("resume_timer");
      expect(useTimerStore.getState().state).toBe("running");
    });
  });

  describe("cancelTimer", () => {
    it("calls invoke and resets state to idle", async () => {
      mockInvoke.mockResolvedValue({
        state: "idle",
        interval_type: "work",
        remaining_ms: 0,
        planned_duration_seconds: 0,
        interval_id: null,
        completed_work_count: 0,
      });

      await useTimerStore.getState().cancelTimer();

      expect(mockInvoke).toHaveBeenCalledWith("cancel_timer");
      expect(useTimerStore.getState().state).toBe("idle");
      expect(useTimerStore.getState().remainingMs).toBe(0);
    });
  });

  describe("setSelectedType", () => {
    it("changes selected type when idle", () => {
      useTimerStore.getState().setSelectedType("short_break");
      expect(useTimerStore.getState().selectedType).toBe("short_break");
    });

    it("does not change selected type when running", () => {
      useTimerStore.setState({ state: "running" });
      useTimerStore.getState().setSelectedType("short_break");
      expect(useTimerStore.getState().selectedType).toBe("work");
    });
  });

  describe("loadSettings", () => {
    it("loads and applies settings from repository", async () => {
      const { getAll } = await import("@/lib/settingsRepository");
      (getAll as Mock).mockResolvedValue([
        {
          key: "work_duration_seconds",
          value: "1800",
          type: "integer",
          updated_at: "2026-02-14T10:00:00Z",
        },
        {
          key: "short_break_duration_seconds",
          value: "420",
          type: "integer",
          updated_at: "2026-02-14T10:00:00Z",
        },
        {
          key: "long_break_duration_seconds",
          value: "1200",
          type: "integer",
          updated_at: "2026-02-14T10:00:00Z",
        },
        {
          key: "long_break_frequency",
          value: "3",
          type: "integer",
          updated_at: "2026-02-14T10:00:00Z",
        },
      ]);

      await useTimerStore.getState().loadSettings();

      const state = useTimerStore.getState();
      expect(state.workDuration).toBe(1800);
      expect(state.shortBreakDuration).toBe(420);
      expect(state.longBreakDuration).toBe(1200);
      expect(state.longBreakFrequency).toBe(3);
    });
  });

  describe("syncState", () => {
    it("fetches timer state from backend", async () => {
      mockInvoke.mockResolvedValue({
        state: "running",
        interval_type: "work",
        remaining_ms: 750000,
        planned_duration_seconds: 1500,
        interval_id: 5,
        completed_work_count: 2,
      });

      await useTimerStore.getState().syncState();

      expect(mockInvoke).toHaveBeenCalledWith("get_timer_state");
      const state = useTimerStore.getState();
      expect(state.state).toBe("running");
      expect(state.remainingMs).toBe(750000);
      expect(state.completedWorkCount).toBe(2);
    });
  });

  describe("event listeners", () => {
    it("registers listeners for timer-tick and timer-complete", async () => {
      await useTimerStore.getState().initEventListeners();

      expect(listeners.has("timer-tick")).toBe(true);
      expect(listeners.has("timer-complete")).toBe(true);
    });

    it("updates remainingMs on timer-tick event", async () => {
      await useTimerStore.getState().initEventListeners();

      const tickCallback = listeners.get("timer-tick");
      tickCallback?.({
        payload: { remaining_ms: 600000, interval_type: "work" },
      });

      expect(useTimerStore.getState().remainingMs).toBe(600000);
      expect(useTimerStore.getState().intervalType).toBe("work");
    });

    it("resets to idle and shows notice on timer-complete event", async () => {
      useTimerStore.setState({ state: "running" });
      await useTimerStore.getState().initEventListeners();

      const completeCallback = listeners.get("timer-complete");
      completeCallback?.({
        payload: {
          interval_id: 1,
          interval_type: "work",
          completed_work_count: 3,
        },
      });

      const state = useTimerStore.getState();
      expect(state.state).toBe("idle");
      expect(state.remainingMs).toBe(0);
      expect(state.completedWorkCount).toBe(3);
      expect(state.showCompletionNotice).toBe(true);
      expect(state.completedIntervalType).toBe("work");
    });

    it("returns unlisten function", async () => {
      const unlisten = await useTimerStore.getState().initEventListeners();

      unlisten();

      expect(mockUnlisten).toHaveBeenCalled();
    });
  });

  describe("dismissCompletionNotice", () => {
    it("hides the completion notice", () => {
      useTimerStore.setState({
        showCompletionNotice: true,
        completedIntervalType: "work",
      });

      useTimerStore.getState().dismissCompletionNotice();

      expect(useTimerStore.getState().showCompletionNotice).toBe(false);
      expect(useTimerStore.getState().completedIntervalType).toBeNull();
    });
  });
});
