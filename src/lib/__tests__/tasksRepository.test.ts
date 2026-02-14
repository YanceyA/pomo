import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockDb, type MockDatabase, resetMockDb } from "./db.mock";

vi.mock("../db", () => ({
  getDb: vi.fn(async () => getMockDb()),
}));

const tasksRepo = await import("../tasksRepository");

const makeTask = (overrides = {}) => ({
  id: 1,
  title: "Write tests",
  day_date: "2026-02-14",
  status: "pending",
  parent_task_id: null,
  linked_from_task_id: null,
  jira_key: null,
  tag: null,
  position: 0,
  created_at: "2026-02-14T09:00:00Z",
  updated_at: "2026-02-14T09:00:00Z",
  ...overrides,
});

describe("tasksRepository", () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    resetMockDb();
    mockDb = getMockDb();
  });

  afterEach(() => {
    resetMockDb();
  });

  describe("create", () => {
    it("inserts a new task and returns the id", async () => {
      mockDb.execute.mockResolvedValue({
        rowsAffected: 1,
        lastInsertId: 7,
      });

      const id = await tasksRepo.create({
        title: "New task",
        day_date: "2026-02-14",
        jira_key: "LRE-42",
        tag: "dev",
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks"),
        ["New task", "2026-02-14", null, "LRE-42", "dev", 0],
      );
      expect(id).toBe(7);
    });

    it("inserts a subtask with parent_task_id", async () => {
      mockDb.execute.mockResolvedValue({
        rowsAffected: 1,
        lastInsertId: 8,
      });

      await tasksRepo.create({
        title: "Subtask",
        day_date: "2026-02-14",
        parent_task_id: 7,
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks"),
        ["Subtask", "2026-02-14", 7, null, null, 0],
      );
    });
  });

  describe("update", () => {
    it("updates title only", async () => {
      await tasksRepo.update(1, { title: "Updated title" });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tasks SET title = $1"),
        ["Updated title", 1],
      );
    });

    it("updates status only", async () => {
      await tasksRepo.update(1, { status: "completed" });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tasks SET status = $1"),
        ["completed", 1],
      );
    });

    it("updates multiple fields", async () => {
      await tasksRepo.update(1, {
        title: "New title",
        tag: "refactor",
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE tasks SET"),
        expect.arrayContaining(["New title", "refactor", 1]),
      );
    });

    it("does nothing when no fields provided", async () => {
      await tasksRepo.update(1, {});

      expect(mockDb.execute).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("deletes the task by id", async () => {
      await tasksRepo.remove(5);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM tasks WHERE id = $1"),
        [5],
      );
    });
  });

  describe("getByDate", () => {
    it("returns tasks for the specified date ordered by position", async () => {
      const tasks = [
        makeTask({ id: 1, position: 0 }),
        makeTask({ id: 2, position: 1 }),
      ];
      mockDb.select.mockResolvedValue(tasks);

      const result = await tasksRepo.getByDate("2026-02-14");

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("WHERE day_date = $1"),
        ["2026-02-14"],
      );
      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY position ASC"),
        expect.anything(),
      );
      expect(result).toHaveLength(2);
    });
  });

  describe("reorder", () => {
    it("updates position for each task id in order", async () => {
      await tasksRepo.reorder([10, 20, 30]);

      expect(mockDb.execute).toHaveBeenCalledTimes(3);
      expect(mockDb.execute).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("UPDATE tasks SET position = $1 WHERE id = $2"),
        [0, 10],
      );
      expect(mockDb.execute).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("UPDATE tasks SET position = $1 WHERE id = $2"),
        [1, 20],
      );
      expect(mockDb.execute).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("UPDATE tasks SET position = $1 WHERE id = $2"),
        [2, 30],
      );
    });
  });

  describe("clone", () => {
    it("creates a copy of the task and its subtasks", async () => {
      const original = makeTask({ id: 1, jira_key: "LRE-1", tag: "dev" });
      const subtask = makeTask({
        id: 2,
        title: "Subtask 1",
        parent_task_id: 1,
      });

      // First select: original task
      mockDb.select
        .mockResolvedValueOnce([original])
        // Second select: subtasks
        .mockResolvedValueOnce([subtask]);

      mockDb.execute
        // Clone parent insert
        .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 100 })
        // Clone subtask insert
        .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 101 });

      const newId = await tasksRepo.clone(1);

      expect(newId).toBe(100);
      // Should have inserted parent clone
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks"),
        expect.arrayContaining([original.title, original.day_date]),
      );
      // Should have inserted subtask clone with new parent id
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks"),
        expect.arrayContaining(["Subtask 1", 100]),
      );
    });

    it("throws when task not found", async () => {
      mockDb.select.mockResolvedValue([]);

      await expect(tasksRepo.clone(999)).rejects.toThrow("Task 999 not found");
    });
  });

  describe("copyToDay", () => {
    it("creates a linked copy on the target date", async () => {
      const original = makeTask({
        id: 1,
        title: "Original task",
        day_date: "2026-02-13",
      });

      mockDb.select.mockResolvedValueOnce([original]).mockResolvedValueOnce([]); // no subtasks

      mockDb.execute.mockResolvedValueOnce({
        rowsAffected: 1,
        lastInsertId: 50,
      });

      const newId = await tasksRepo.copyToDay(1, "2026-02-14");

      expect(newId).toBe(50);
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks"),
        expect.arrayContaining(["Original task", "2026-02-14", 1]),
      );
    });

    it("copies subtasks to the new parent", async () => {
      const original = makeTask({ id: 1 });
      const subtask = makeTask({
        id: 2,
        title: "Sub",
        parent_task_id: 1,
      });

      mockDb.select
        .mockResolvedValueOnce([original])
        .mockResolvedValueOnce([subtask]);

      mockDb.execute
        .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 50 })
        .mockResolvedValueOnce({ rowsAffected: 1, lastInsertId: 51 });

      await tasksRepo.copyToDay(1, "2026-02-14");

      // Subtask should reference new parent (50), not original parent (1)
      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO tasks"),
        expect.arrayContaining(["Sub", "2026-02-14", 50]),
      );
    });
  });
});
