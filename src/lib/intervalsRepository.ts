import { z } from "zod";
import { getDb } from "./db";
import {
  type CreateIntervalInput,
  type TimerInterval,
  timerIntervalSchema,
} from "./schemas";

export async function create(input: CreateIntervalInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO timer_intervals (interval_type, start_time, planned_duration_seconds, status)
		 VALUES ($1, $2, $3, 'in_progress')`,
    [input.interval_type, input.start_time, input.planned_duration_seconds],
  );
  return result.lastInsertId as number;
}

export async function complete(
  id: number,
  endTime: string,
  durationSeconds: number,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE timer_intervals
		 SET status = 'completed', end_time = $1, duration_seconds = $2
		 WHERE id = $3`,
    [endTime, durationSeconds, id],
  );
}

export async function cancel(
  id: number,
  endTime: string,
  durationSeconds: number,
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE timer_intervals
		 SET status = 'cancelled', end_time = $1, duration_seconds = $2
		 WHERE id = $3`,
    [endTime, durationSeconds, id],
  );
}

export async function getByDateRange(
  startDate: string,
  endDate: string,
): Promise<TimerInterval[]> {
  const db = await getDb();
  const rows = await db.select<TimerInterval[]>(
    `SELECT id, interval_type, start_time, end_time, duration_seconds,
		        planned_duration_seconds, status, created_at
		 FROM timer_intervals
		 WHERE start_time >= $1 AND start_time < $2
		 ORDER BY start_time ASC`,
    [startDate, endDate],
  );
  return z.array(timerIntervalSchema).parse(rows);
}
