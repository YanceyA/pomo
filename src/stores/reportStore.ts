import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";
import type { DailySummary, WeeklySummary } from "@/lib/schemas";

// ── Helpers ──────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Store interface ──────────────────────────────────────────

export interface ReportStore {
  // Tab state
  activeTab: "daily" | "weekly";

  // Daily
  dailyDate: string;
  dailySummary: DailySummary | null;
  isDailyLoading: boolean;

  // Weekly
  weekStart: string;
  weeklySummary: WeeklySummary | null;
  isWeeklyLoading: boolean;

  // Actions
  setActiveTab: (tab: "daily" | "weekly") => void;
  loadDailySummary: (date?: string) => Promise<void>;
  setDailyDate: (date: string) => Promise<void>;
  prevDay: () => Promise<void>;
  nextDay: () => Promise<void>;
  goToToday: () => Promise<void>;
  loadWeeklySummary: (weekStart?: string) => Promise<void>;
  setWeekStart: (weekStart: string) => Promise<void>;
  prevWeek: () => Promise<void>;
  nextWeek: () => Promise<void>;
  goToCurrentWeek: () => Promise<void>;
}

// ── Store ────────────────────────────────────────────────────

export const useReportStore = create<ReportStore>((set, get) => ({
  activeTab: "daily",
  dailyDate: todayStr(),
  dailySummary: null,
  isDailyLoading: false,
  weekStart: getMonday(todayStr()),
  weeklySummary: null,
  isWeeklyLoading: false,

  setActiveTab: (tab) => {
    set({ activeTab: tab });
    if (tab === "daily" && !get().dailySummary) {
      get().loadDailySummary();
    } else if (tab === "weekly" && !get().weeklySummary) {
      get().loadWeeklySummary();
    }
  },

  loadDailySummary: async (date) => {
    const dayDate = date ?? get().dailyDate;
    set({ isDailyLoading: true });
    try {
      const summary = await invoke<DailySummary>("get_daily_summary", {
        dayDate,
      });
      set({ dailySummary: summary, dailyDate: dayDate, isDailyLoading: false });
    } catch {
      set({ isDailyLoading: false });
    }
  },

  setDailyDate: async (date) => {
    set({ dailyDate: date });
    await get().loadDailySummary(date);
  },

  prevDay: async () => {
    const prev = addDays(get().dailyDate, -1);
    await get().setDailyDate(prev);
  },

  nextDay: async () => {
    const next = addDays(get().dailyDate, 1);
    await get().setDailyDate(next);
  },

  goToToday: async () => {
    await get().setDailyDate(todayStr());
  },

  loadWeeklySummary: async (weekStart) => {
    const ws = weekStart ?? get().weekStart;
    set({ isWeeklyLoading: true });
    try {
      const summary = await invoke<WeeklySummary>("get_weekly_summary", {
        weekStart: ws,
      });
      set({
        weeklySummary: summary,
        weekStart: ws,
        isWeeklyLoading: false,
      });
    } catch {
      set({ isWeeklyLoading: false });
    }
  },

  setWeekStart: async (weekStart) => {
    set({ weekStart });
    await get().loadWeeklySummary(weekStart);
  },

  prevWeek: async () => {
    const prev = addDays(get().weekStart, -7);
    await get().setWeekStart(prev);
  },

  nextWeek: async () => {
    const next = addDays(get().weekStart, 7);
    await get().setWeekStart(next);
  },

  goToCurrentWeek: async () => {
    await get().setWeekStart(getMonday(todayStr()));
  },
}));
