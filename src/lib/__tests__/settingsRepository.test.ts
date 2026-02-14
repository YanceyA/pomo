import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMockDb, type MockDatabase, resetMockDb } from "./db.mock";

vi.mock("../db", () => ({
  getDb: vi.fn(async () => getMockDb()),
}));

// Must import after vi.mock
const settingsRepo = await import("../settingsRepository");

describe("settingsRepository", () => {
  let mockDb: MockDatabase;

  beforeEach(() => {
    resetMockDb();
    mockDb = getMockDb();
  });

  afterEach(() => {
    resetMockDb();
  });

  describe("get", () => {
    it("queries by key and returns the setting", async () => {
      const setting = {
        key: "work_duration_minutes",
        value: "25",
        type: "integer",
        updated_at: "2026-02-14T10:00:00Z",
      };
      mockDb.select.mockResolvedValue([setting]);

      const result = await settingsRepo.get("work_duration_minutes");

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("FROM user_settings WHERE key = $1"),
        ["work_duration_minutes"],
      );
      expect(result).toEqual(setting);
    });

    it("returns null when key not found", async () => {
      mockDb.select.mockResolvedValue([]);

      const result = await settingsRepo.get("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("executes an UPDATE with the correct parameters", async () => {
      await settingsRepo.set("work_duration_minutes", "30");

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE user_settings SET value = $1"),
        ["30", "work_duration_minutes"],
      );
    });
  });

  describe("getAll", () => {
    it("returns all settings", async () => {
      const settings = [
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
      ];
      mockDb.select.mockResolvedValue(settings);

      const result = await settingsRepo.getAll();

      expect(mockDb.select).toHaveBeenCalledWith(
        expect.stringContaining("FROM user_settings"),
      );
      expect(result).toEqual(settings);
      expect(result).toHaveLength(2);
    });
  });
});
