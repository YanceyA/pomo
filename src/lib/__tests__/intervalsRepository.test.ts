import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockDb, type MockDatabase, resetMockDb } from "./db.mock";

vi.mock("../db", () => ({
  getDb: vi.fn(async () => getMockDb()),
}));

const intervalsRepo = await import("../intervalsRepository");

describe("intervalsRepository", () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    resetMockDb();
    mockDb = getMockDb();
  });

  afterEach(() => {
    resetMockDb();
  });

  describe("create", () => {
    it("inserts a new interval and returns the id", async () => {
      mockDb.execute.mockResolvedValue({
        rowsAffected: 1,
        lastInsertId: 42,
      });

      const id = await intervalsRepo.create({
        interval_type: "work",
        start_time: "2026-02-14T09:00:00Z",
        planned_duration_seconds: 1500,
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO timer_intervals"),
        ["work", "2026-02-14T09:00:00Z", 1500],
      );
      expect(id).toBe(42);
    });
  });

  describe("complete", () => {
    it("updates status to completed with end time and duration", async () => {
      await intervalsRepo.complete(1, "2026-02-14T09:25:00Z", 1500);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'completed'"),
        ["2026-02-14T09:25:00Z", 1500, 1],
      );
    });
  });

  describe("cancel", () => {
    it("updates status to cancelled with end time and duration", async () => {
      await intervalsRepo.cancel(5, "2026-02-14T09:10:00Z", 600);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("SET status = 'cancelled'"),
        ["2026-02-14T09:10:00Z", 600, 5],
      );
    });
  });

  describe("getByDateRange", () => {
    it("returns intervals within the date range", async () => {
      const intervals = [
        {
          id: 1,
          interval_type: "work",
          start_time: "2026-02-14T09:00:00Z",
          end_time: "2026-02-14T09:25:00Z",
          duration_seconds: 1500,
          planned_duration_seconds: 1500,
          status: "completed",
          created_at: "2026-02-14T09:00:00Z",
        },
      ];
      mockDb.select.mockResolvedValue(intervals);

      const result = await intervalsRepo.getByDateRange(
        "2026-02-14T00:00:00Z",
        "2026-02-15T00:00:00Z",
      );

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("WHERE start_time >= $1 AND start_time < $2"),
        ["2026-02-14T00:00:00Z", "2026-02-15T00:00:00Z"],
      );
      expect(result).toHaveLength(1);
      expect(result[0].interval_type).toBe("work");
    });
  });
});
