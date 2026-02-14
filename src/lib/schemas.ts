import { z } from "zod";

// --- User Settings ---

const settingType = z.enum(["string", "integer", "real", "boolean", "json"]);

export const settingSchema = z.object({
  key: z.string(),
  value: z.string(),
  type: settingType,
  updated_at: z.string(),
});

export type Setting = z.infer<typeof settingSchema>;

// --- Timer Intervals ---

export const intervalType = z.enum(["work", "short_break", "long_break"]);
export type IntervalType = z.infer<typeof intervalType>;

const intervalStatus = z.enum(["in_progress", "completed", "cancelled"]);
export type IntervalStatus = z.infer<typeof intervalStatus>;

export const timerIntervalSchema = z.object({
  id: z.number(),
  interval_type: intervalType,
  start_time: z.string(),
  end_time: z.string().nullable(),
  duration_seconds: z.number().nullable(),
  planned_duration_seconds: z.number(),
  status: intervalStatus,
  created_at: z.string(),
});

export type TimerInterval = z.infer<typeof timerIntervalSchema>;

// --- Tasks ---

export const taskStatus = z.enum(["pending", "completed", "abandoned"]);
export type TaskStatus = z.infer<typeof taskStatus>;

export const taskSchema = z.object({
  id: z.number(),
  title: z.string(),
  day_date: z.string(),
  status: taskStatus,
  parent_task_id: z.number().nullable(),
  linked_from_task_id: z.number().nullable(),
  jira_key: z.string().nullable(),
  tag: z.string().nullable(),
  position: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_in_pomodoro: z.number().nullable(),
});

export type Task = z.infer<typeof taskSchema>;

// --- Task–Interval Links ---

export const taskIntervalLinkSchema = z.object({
  id: z.number(),
  task_id: z.number(),
  interval_id: z.number(),
  created_at: z.string(),
});

export type TaskIntervalLink = z.infer<typeof taskIntervalLinkSchema>;

// --- Report types ---

export const intervalSummarySchema = z.object({
  id: z.number(),
  interval_type: z.string(),
  start_time: z.string(),
  end_time: z.string().nullable(),
  duration_seconds: z.number(),
  planned_duration_seconds: z.number(),
  status: z.string(),
});

export type IntervalSummary = z.infer<typeof intervalSummarySchema>;

export const taskSummarySchema = z.object({
  id: z.number(),
  title: z.string(),
  status: z.string(),
  jira_key: z.string().nullable(),
  tag: z.string().nullable(),
  completed_in_pomodoro: z.number().nullable(),
});

export type TaskSummary = z.infer<typeof taskSummarySchema>;

export const taskGroupSchema = z.object({
  jira_key: z.string().nullable(),
  tasks: z.array(taskSummarySchema),
});

export type TaskGroup = z.infer<typeof taskGroupSchema>;

export const dailySummarySchema = z.object({
  date: z.string(),
  pomodoro_count: z.number(),
  total_focus_minutes: z.number(),
  tasks_completed: z.number(),
  tasks_total: z.number(),
  intervals: z.array(intervalSummarySchema),
  task_groups: z.array(taskGroupSchema),
});

export type DailySummary = z.infer<typeof dailySummarySchema>;

export const dailyStatSchema = z.object({
  date: z.string(),
  pomodoro_count: z.number(),
  focus_minutes: z.number(),
  tasks_completed: z.number(),
});

export type DailyStat = z.infer<typeof dailyStatSchema>;

export const weeklySummarySchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  daily_stats: z.array(dailyStatSchema),
  total_pomodoros: z.number(),
  total_focus_minutes: z.number(),
  total_tasks_completed: z.number(),
  task_groups: z.array(taskGroupSchema),
});

export type WeeklySummary = z.infer<typeof weeklySummarySchema>;

export const weekStatSchema = z.object({
  week_start: z.string(),
  week_end: z.string(),
  pomodoro_count: z.number(),
  focus_minutes: z.number(),
  tasks_completed: z.number(),
});

export type WeekStat = z.infer<typeof weekStatSchema>;

export const monthlySummarySchema = z.object({
  month_start: z.string(),
  month_end: z.string(),
  weekly_stats: z.array(weekStatSchema),
  total_pomodoros: z.number(),
  total_focus_minutes: z.number(),
  total_tasks_completed: z.number(),
});

export type MonthlySummary = z.infer<typeof monthlySummarySchema>;

// --- Input types (for create/update operations) ---

export interface CreateIntervalInput {
  interval_type: IntervalType;
  start_time: string;
  planned_duration_seconds: number;
}

export interface CreateTaskInput {
  title: string;
  day_date: string;
  parent_task_id?: number | null;
  jira_key?: string | null;
  tag?: string | null;
  position?: number;
}

export interface UpdateTaskInput {
  title?: string;
  status?: TaskStatus;
  jira_key?: string | null;
  tag?: string | null;
}
