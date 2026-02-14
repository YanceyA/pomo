import { z } from "zod";
import { getDb } from "./db";
import { type Setting, settingSchema } from "./schemas";

export async function get(key: string): Promise<Setting | null> {
  const db = await getDb();
  const rows = await db.select<Setting[]>(
    "SELECT key, value, type, updated_at FROM user_settings WHERE key = $1",
    [key],
  );
  if (rows.length === 0) return null;
  return z.array(settingSchema).parse(rows)[0];
}

export async function set(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "UPDATE user_settings SET value = $1, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE key = $2",
    [value, key],
  );
}

export async function getAll(): Promise<Setting[]> {
  const db = await getDb();
  const rows = await db.select<Setting[]>(
    "SELECT key, value, type, updated_at FROM user_settings",
  );
  return z.array(settingSchema).parse(rows);
}
