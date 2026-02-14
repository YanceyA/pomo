import { type Mock, vi } from "vitest";

export interface MockDatabase {
  select: Mock;
  execute: Mock;
  close: Mock;
}

export function createMockDb(): MockDatabase {
  return {
    select: vi.fn().mockResolvedValue([]),
    execute: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertId: 1 }),
    close: vi.fn().mockResolvedValue(true),
  };
}

let mockDb: MockDatabase | null = null;

export function getMockDb(): MockDatabase {
  if (!mockDb) {
    mockDb = createMockDb();
  }
  return mockDb;
}

export function resetMockDb(): void {
  mockDb = null;
}
