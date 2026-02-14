import { z } from "zod";
import { getDb } from "./db";
import {
  type CreateTaskInput,
  type Task,
  taskSchema,
  type UpdateTaskInput,
} from "./schemas";

const TASK_COLUMNS = `id, title, day_date, status, parent_task_id, linked_from_task_id,
	jira_key, tag, position, created_at, updated_at`;

export async function create(input: CreateTaskInput): Promise<number> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO tasks (title, day_date, parent_task_id, jira_key, tag, position)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.title,
      input.day_date,
      input.parent_task_id ?? null,
      input.jira_key ?? null,
      input.tag ?? null,
      input.position ?? 0,
    ],
  );
  return result.lastInsertId as number;
}

export async function update(
  id: number,
  input: UpdateTaskInput,
): Promise<void> {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(input.title);
  }
  if (input.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`);
    values.push(input.status);
  }
  if (input.jira_key !== undefined) {
    setClauses.push(`jira_key = $${paramIndex++}`);
    values.push(input.jira_key);
  }
  if (input.tag !== undefined) {
    setClauses.push(`tag = $${paramIndex++}`);
    values.push(input.tag);
  }

  if (setClauses.length === 0) return;

  setClauses.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`);
  values.push(id);

  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET ${setClauses.join(", ")} WHERE id = $${paramIndex}`,
    values,
  );
}

export async function remove(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

export async function getByDate(dayDate: string): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks
		 WHERE day_date = $1
		 ORDER BY position ASC, created_at ASC`,
    [dayDate],
  );
  return z.array(taskSchema).parse(rows);
}

export async function reorder(taskIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < taskIds.length; i++) {
    await db.execute("UPDATE tasks SET position = $1 WHERE id = $2", [
      i,
      taskIds[i],
    ]);
  }
}

export async function clone(id: number): Promise<number> {
  const db = await getDb();

  // Fetch original task
  const rows = await db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`,
    [id],
  );
  const original = z.array(taskSchema).parse(rows)[0];
  if (!original) throw new Error(`Task ${id} not found`);

  // Clone parent task
  const result = await db.execute(
    `INSERT INTO tasks (title, day_date, status, jira_key, tag, position)
		 VALUES ($1, $2, 'pending', $3, $4, $5)`,
    [
      original.title,
      original.day_date,
      original.jira_key,
      original.tag,
      original.position,
    ],
  );
  const newId = result.lastInsertId as number;

  // Clone subtasks
  const subtasks = await db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE parent_task_id = $1`,
    [id],
  );
  for (const sub of z.array(taskSchema).parse(subtasks)) {
    await db.execute(
      `INSERT INTO tasks (title, day_date, status, parent_task_id, jira_key, tag, position)
			 VALUES ($1, $2, 'pending', $3, $4, $5, $6)`,
      [sub.title, sub.day_date, newId, sub.jira_key, sub.tag, sub.position],
    );
  }

  return newId;
}

export async function copyToDay(
  id: number,
  targetDate: string,
): Promise<number> {
  const db = await getDb();

  // Fetch original task
  const rows = await db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`,
    [id],
  );
  const original = z.array(taskSchema).parse(rows)[0];
  if (!original) throw new Error(`Task ${id} not found`);

  // Create copy with link back to original
  const result = await db.execute(
    `INSERT INTO tasks (title, day_date, status, linked_from_task_id, jira_key, tag, position)
		 VALUES ($1, $2, 'pending', $3, $4, $5, $6)`,
    [original.title, targetDate, id, original.jira_key, original.tag, 0],
  );
  const newId = result.lastInsertId as number;

  // Copy subtasks
  const subtasks = await db.select<Task[]>(
    `SELECT ${TASK_COLUMNS} FROM tasks WHERE parent_task_id = $1`,
    [id],
  );
  for (const sub of z.array(taskSchema).parse(subtasks)) {
    await db.execute(
      `INSERT INTO tasks (title, day_date, status, parent_task_id, jira_key, tag, position)
			 VALUES ($1, $2, 'pending', $3, $4, $5, $6)`,
      [sub.title, targetDate, newId, sub.jira_key, sub.tag, sub.position],
    );
  }

  return newId;
}
