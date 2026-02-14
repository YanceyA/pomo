import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockDb, type MockDatabase, resetMockDb } from "./db.mock";

vi.mock("../db", () => ({
  getDb: vi.fn(async () => getMockDb()),
}));

const linksRepo = await import("../taskIntervalLinksRepository");

describe("taskIntervalLinksRepository", () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    resetMockDb();
    mockDb = getMockDb();
  });

  afterEach(() => {
    resetMockDb();
  });

  describe("link", () => {
    it("inserts a new link and returns the id", async () => {
      mockDb.execute.mockResolvedValue({
        rowsAffected: 1,
        lastInsertId: 10,
      });

      const id = await linksRepo.link(5, 3);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_interval_links"),
        [5, 3],
      );
      expect(id).toBe(10);
    });
  });

  describe("getByInterval", () => {
    it("returns links for the given interval", async () => {
      const links = [
        {
          id: 1,
          task_id: 5,
          interval_id: 3,
          created_at: "2026-02-14T09:25:00Z",
        },
        {
          id: 2,
          task_id: 6,
          interval_id: 3,
          created_at: "2026-02-14T09:25:00Z",
        },
      ];
      mockDb.select.mockResolvedValue(links);

      const result = await linksRepo.getByInterval(3);

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("WHERE interval_id = $1"),
        [3],
      );
      expect(result).toHaveLength(2);
      expect(result[0].task_id).toBe(5);
    });
  });

  describe("getByTask", () => {
    it("returns links for the given task", async () => {
      const links = [
        {
          id: 1,
          task_id: 5,
          interval_id: 3,
          created_at: "2026-02-14T09:25:00Z",
        },
      ];
      mockDb.select.mockResolvedValue(links);

      const result = await linksRepo.getByTask(5);

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("WHERE task_id = $1"),
        [5],
      );
      expect(result).toHaveLength(1);
      expect(result[0].interval_id).toBe(3);
    });
  });
});
