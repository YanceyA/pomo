import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { IntervalType } from "@/lib/schemas";
import * as settingsRepository from "@/lib/settingsRepository";

// ── Types ──────────────────────────────────────────────────

type TimerState = "idle" | "running" | "paused";

interface TimerStatus {
  state: TimerState;
  interval_type: IntervalType;
  remaining_ms: number;
  planned_duration_seconds: number;
  interval_id: number | null;
  completed_work_count: number;
}

interface TimerTickPayload {
  remaining_ms: number;
  interval_type: IntervalType;
}

interface TimerCompletePayload {
  interval_id: number;
  interval_type: IntervalType;
  completed_work_count: number;
}

// ── Store interface ────────────────────────────────────────

export interface TimerStore {
  // State
  state: TimerState;
  intervalType: IntervalType;
  remainingMs: number;
  plannedDurationSeconds: number;
  intervalId: number | null;
  completedWorkCount: number;

  // Settings
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakFrequency: number;

  // Completion notification
  showCompletionNotice: boolean;
  completedIntervalType: IntervalType | null;

  // Association dialog (work interval only)
  showAssociationDialog: boolean;
  lastCompletedIntervalId: number | null;

  // Selected type for next interval (when idle)
  selectedType: IntervalType;

  // Actions
  startTimer: () => Promise<void>;
  pauseTimer: () => Promise<void>;
  resumeTimer: () => Promise<void>;
  cancelTimer: () => Promise<void>;
  setSelectedType: (type: IntervalType) => void;
  dismissCompletionNotice: () => void;
  showAssociation: (intervalId: number) => void;
  dismissAssociationDialog: () => void;
  loadSettings: () => Promise<void>;
  syncState: () => Promise<void>;
  initEventListeners: () => Promise<() => void>;
}

// ── Helpers ────────────────────────────────────────────────

function getDurationForType(
  type: IntervalType,
  store: {
    workDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
  },
): number {
  switch (type) {
    case "work":
      return store.workDuration;
    case "short_break":
      return store.shortBreakDuration;
    case "long_break":
      return store.longBreakDuration;
  }
}

function applyStatus(status: TimerStatus): Partial<TimerStore> {
  return {
    state: status.state,
    intervalType: status.interval_type,
    remainingMs: status.remaining_ms,
    plannedDurationSeconds: status.planned_duration_seconds,
    intervalId: status.interval_id ?? null,
    completedWorkCount: status.completed_work_count,
  };
}

// ── Store ──────────────────────────────────────────────────

export const useTimerStore = create<TimerStore>((set, get) => ({
  // Initial state
  state: "idle",
  intervalType: "work",
  remainingMs: 0,
  plannedDurationSeconds: 0,
  intervalId: null,
  completedWorkCount: 0,

  // Default settings
  workDuration: 1500,
  shortBreakDuration: 300,
  longBreakDuration: 900,
  longBreakFrequency: 4,

  // Completion
  showCompletionNotice: false,
  completedIntervalType: null,

  // Association dialog
  showAssociationDialog: false,
  lastCompletedIntervalId: null,

  // Selected type
  selectedType: "work",

  startTimer: async () => {
    const { selectedType } = get();
    const duration = getDurationForType(selectedType, get());
    const status = await invoke<TimerStatus>("start_timer", {
      intervalType: selectedType,
      durationSeconds: duration,
    });
    set(applyStatus(status));
  },

  pauseTimer: async () => {
    const status = await invoke<TimerStatus>("pause_timer");
    set(applyStatus(status));
  },

  resumeTimer: async () => {
    const status = await invoke<TimerStatus>("resume_timer");
    set(applyStatus(status));
  },

  cancelTimer: async () => {
    const status = await invoke<TimerStatus>("cancel_timer");
    set(applyStatus(status));
  },

  setSelectedType: (type: IntervalType) => {
    if (get().state !== "idle") return;
    set({ selectedType: type });
  },

  dismissCompletionNotice: () => {
    set({ showCompletionNotice: false, completedIntervalType: null });
  },

  showAssociation: (intervalId: number) => {
    set({ showAssociationDialog: true, lastCompletedIntervalId: intervalId });
  },

  dismissAssociationDialog: () => {
    set({ showAssociationDialog: false, lastCompletedIntervalId: null });
  },

  loadSettings: async () => {
    const settings = await settingsRepository.getAll();
    const map = new Map(settings.map((s) => [s.key, s.value]));

    set({
      workDuration: Number(map.get("work_duration_seconds")) || 1500,
      shortBreakDuration:
        Number(map.get("short_break_duration_seconds")) || 300,
      longBreakDuration: Number(map.get("long_break_duration_seconds")) || 900,
      longBreakFrequency: Number(map.get("long_break_frequency")) || 4,
    });
  },

  syncState: async () => {
    const status = await invoke<TimerStatus>("get_timer_state");
    set(applyStatus(status));
  },

  initEventListeners: async () => {
    const unlistenTick = await listen<TimerTickPayload>(
      "timer-tick",
      (event) => {
        set({
          remainingMs: event.payload.remaining_ms,
          intervalType: event.payload.interval_type,
        });
      },
    );

    const unlistenComplete = await listen<TimerCompletePayload>(
      "timer-complete",
      (event) => {
        const isWork = event.payload.interval_type === "work";
        set({
          state: "idle",
          remainingMs: 0,
          intervalId: null,
          completedWorkCount: event.payload.completed_work_count,
          showCompletionNotice: true,
          completedIntervalType: event.payload.interval_type,
          // Show association dialog only for work intervals
          showAssociationDialog: isWork,
          lastCompletedIntervalId: isWork ? event.payload.interval_id : null,
        });
      },
    );

    return () => {
      unlistenTick();
      unlistenComplete();
    };
  },
}));
