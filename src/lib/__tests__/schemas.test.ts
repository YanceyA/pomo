import { describe, expect, it } from "vitest";
import {
  settingSchema,
  taskIntervalLinkSchema,
  taskSchema,
  timerIntervalSchema,
} from "../schemas";

describe("settingSchema", () => {
  it("validates a well-formed setting", () => {
    const data = {
      key: "work_duration_minutes",
      value: "25",
      type: "integer",
      updated_at: "2026-02-14T10:00:00Z",
    };
    expect(settingSchema.parse(data)).toEqual(data);
  });

  it("rejects invalid type value", () => {
    const data = {
      key: "test",
      value: "val",
      type: "invalid",
      updated_at: "2026-02-14T10:00:00Z",
    };
    expect(() => settingSchema.parse(data)).toThrow();
  });

  it("rejects missing key", () => {
    const data = {
      value: "25",
      type: "integer",
      updated_at: "2026-02-14T10:00:00Z",
    };
    expect(() => settingSchema.parse(data)).toThrow();
  });
});

describe("timerIntervalSchema", () => {
  it("validates a completed interval", () => {
    const data = {
      id: 1,
      interval_type: "work",
      start_time: "2026-02-14T09:00:00Z",
      end_time: "2026-02-14T09:25:00Z",
      duration_seconds: 1500,
      planned_duration_seconds: 1500,
      status: "completed",
      created_at: "2026-02-14T09:00:00Z",
    };
    expect(timerIntervalSchema.parse(data)).toEqual(data);
  });

  it("validates an in-progress interval with nullable fields", () => {
    const data = {
      id: 2,
      interval_type: "short_break",
      start_time: "2026-02-14T09:25:00Z",
      end_time: null,
      duration_seconds: null,
      planned_duration_seconds: 300,
      status: "in_progress",
      created_at: "2026-02-14T09:25:00Z",
    };
    expect(timerIntervalSchema.parse(data)).toEqual(data);
  });

  it("rejects invalid interval_type", () => {
    const data = {
      id: 1,
      interval_type: "meditation",
      start_time: "2026-02-14T09:00:00Z",
      end_time: null,
      duration_seconds: null,
      planned_duration_seconds: 1500,
      status: "in_progress",
      created_at: "2026-02-14T09:00:00Z",
    };
    expect(() => timerIntervalSchema.parse(data)).toThrow();
  });

  it("rejects invalid status", () => {
    const data = {
      id: 1,
      interval_type: "work",
      start_time: "2026-02-14T09:00:00Z",
      end_time: null,
      duration_seconds: null,
      planned_duration_seconds: 1500,
      status: "paused",
      created_at: "2026-02-14T09:00:00Z",
    };
    expect(() => timerIntervalSchema.parse(data)).toThrow();
  });
});

describe("taskSchema", () => {
  it("validates a well-formed task", () => {
    const data = {
      id: 1,
      title: "Write unit tests",
      day_date: "2026-02-14",
      status: "pending",
      parent_task_id: null,
      linked_from_task_id: null,
      jira_key: "LRE-123",
      tag: "dev",
      position: 0,
      created_at: "2026-02-14T09:00:00Z",
      updated_at: "2026-02-14T09:00:00Z",
      completed_in_pomodoro: null,
    };
    expect(taskSchema.parse(data)).toEqual(data);
  });

  it("validates a subtask with parent_task_id", () => {
    const data = {
      id: 2,
      title: "Sub-task",
      day_date: "2026-02-14",
      status: "completed",
      parent_task_id: 1,
      linked_from_task_id: null,
      jira_key: null,
      tag: null,
      position: 0,
      created_at: "2026-02-14T09:00:00Z",
      updated_at: "2026-02-14T09:00:00Z",
      completed_in_pomodoro: 3,
    };
    expect(taskSchema.parse(data)).toEqual(data);
  });

  it("rejects invalid status", () => {
    const data = {
      id: 1,
      title: "Test",
      day_date: "2026-02-14",
      status: "deleted",
      parent_task_id: null,
      linked_from_task_id: null,
      jira_key: null,
      tag: null,
      position: 0,
      created_at: "2026-02-14T09:00:00Z",
      updated_at: "2026-02-14T09:00:00Z",
      completed_in_pomodoro: null,
    };
    expect(() => taskSchema.parse(data)).toThrow();
  });

  it("rejects missing title", () => {
    const data = {
      id: 1,
      day_date: "2026-02-14",
      status: "pending",
      parent_task_id: null,
      linked_from_task_id: null,
      jira_key: null,
      tag: null,
      position: 0,
      created_at: "2026-02-14T09:00:00Z",
      updated_at: "2026-02-14T09:00:00Z",
      completed_in_pomodoro: null,
    };
    expect(() => taskSchema.parse(data)).toThrow();
  });
});

describe("taskIntervalLinkSchema", () => {
  it("validates a well-formed link", () => {
    const data = {
      id: 1,
      task_id: 5,
      interval_id: 3,
      created_at: "2026-02-14T09:25:00Z",
    };
    expect(taskIntervalLinkSchema.parse(data)).toEqual(data);
  });

  it("rejects missing task_id", () => {
    const data = {
      id: 1,
      interval_id: 3,
      created_at: "2026-02-14T09:25:00Z",
    };
    expect(() => taskIntervalLinkSchema.parse(data)).toThrow();
  });

  it("rejects non-numeric interval_id", () => {
    const data = {
      id: 1,
      task_id: 5,
      interval_id: "abc",
      created_at: "2026-02-14T09:25:00Z",
    };
    expect(() => taskIntervalLinkSchema.parse(data)).toThrow();
  });
});
