import { z } from "zod";
import { getDb } from "./db";
import { type TaskIntervalLink, taskIntervalLinkSchema } from "./schemas";

export async function link(
  taskId: number,
  intervalId: number,
): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO task_interval_links (task_id, interval_id)
		 VALUES ($1, $2)`,
    [taskId, intervalId],
  );
  return result.lastInsertId as number;
}

export async function getByInterval(
  intervalId: number,
): Promise<TaskIntervalLink[]> {
  const db = await getDb();
  const rows = await db.select<TaskIntervalLink[]>(
    `SELECT id, task_id, interval_id, created_at
		 FROM task_interval_links
		 WHERE interval_id = $1`,
    [intervalId],
  );
  return z.array(taskIntervalLinkSchema).parse(rows);
}

export async function getByTask(taskId: number): Promise<TaskIntervalLink[]> {
  const db = await getDb();
  const rows = await db.select<TaskIntervalLink[]>(
    `SELECT id, task_id, interval_id, created_at
		 FROM task_interval_links
		 WHERE task_id = $1`,
    [taskId],
  );
  return z.array(taskIntervalLinkSchema).parse(rows);
}
