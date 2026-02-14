import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { create } from "zustand";
import type { Task } from "@/lib/schemas";

// ── Types ──────────────────────────────────────────────────

interface TaskFromBackend {
  id: number;
  title: string;
  day_date: string;
  status: string;
  parent_task_id: number | null;
  linked_from_task_id: number | null;
  jira_key: string | null;
  tag: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface TaskIntervalCountFromBackend {
  task_id: number;
  count: number;
}

interface PendingDelete {
  taskId: number;
  timeoutId: number;
}

// ── Store interface ────────────────────────────────────────

export interface TaskStore {
  // State
  tasks: Task[];
  selectedDate: string;
  isLoading: boolean;

  // Interval link counts (task_id → count)
  intervalCounts: Record<number, number>;

  // Task creation dialog
  showCreateDialog: boolean;
  createParentId: number | null;

  // Task edit dialog
  showEditDialog: boolean;
  editTask: Task | null;

  // Pending delete (undo toast)
  pendingDelete: PendingDelete | null;

  // Actions
  loadTasks: (date?: string) => Promise<void>;
  setSelectedDate: (date: string) => Promise<void>;
  createTask: (input: {
    title: string;
    jiraKey?: string | null;
    tag?: string | null;
    parentTaskId?: number | null;
  }) => Promise<void>;
  updateTask: (
    id: number,
    input: { title?: string; jiraKey?: string | null; tag?: string | null },
  ) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  softDeleteTask: (id: number) => void;
  undoDelete: () => void;
  completeTask: (id: number) => Promise<void>;
  abandonTask: (id: number) => Promise<void>;
  reopenTask: (id: number) => Promise<void>;
  cloneTask: (id: number) => Promise<void>;
  reorderTasks: (taskIds: number[]) => Promise<void>;
  openCreateDialog: (parentId?: number | null) => void;
  closeCreateDialog: () => void;
  openEditDialog: (task: Task) => void;
  closeEditDialog: () => void;
}

// ── Helpers ────────────────────────────────────────────────

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function backendToTask(t: TaskFromBackend): Task {
  return {
    id: t.id,
    title: t.title,
    day_date: t.day_date,
    status: t.status as Task["status"],
    parent_task_id: t.parent_task_id,
    linked_from_task_id: t.linked_from_task_id,
    jira_key: t.jira_key,
    tag: t.tag,
    position: t.position,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

// ── Store ──────────────────────────────────────────────────

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedDate: todayString(),
  isLoading: false,
  intervalCounts: {},
  showCreateDialog: false,
  createParentId: null,
  showEditDialog: false,
  editTask: null,
  pendingDelete: null,

  loadTasks: async (date?: string) => {
    const dayDate = date ?? get().selectedDate;
    set({ isLoading: true });
    try {
      const [tasks, counts] = await Promise.all([
        invoke<TaskFromBackend[]>("get_tasks_by_date", { dayDate }),
        invoke<TaskIntervalCountFromBackend[]>("get_task_interval_counts", {
          dayDate,
        }),
      ]);
      const intervalCounts: Record<number, number> = {};
      for (const c of counts) {
        intervalCounts[c.task_id] = c.count;
      }
      set({
        tasks: tasks.map(backendToTask),
        intervalCounts,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setSelectedDate: async (date: string) => {
    set({ selectedDate: date });
    await get().loadTasks(date);
  },

  createTask: async (input) => {
    const { selectedDate } = get();
    await invoke<TaskFromBackend>("create_task", {
      title: input.title,
      dayDate: selectedDate,
      parentTaskId: input.parentTaskId ?? null,
      jiraKey: input.jiraKey ?? null,
      tag: input.tag ?? null,
    });
    await get().loadTasks();
  },

  updateTask: async (id, input) => {
    await invoke<TaskFromBackend>("update_task", {
      id,
      title: input.title ?? null,
      jiraKey: input.jiraKey ?? null,
      tag: input.tag ?? null,
    });
    await get().loadTasks();
  },

  deleteTask: async (id) => {
    await invoke<void>("delete_task", { id });
    await get().loadTasks();
  },

  softDeleteTask: (id: number) => {
    // Remove from UI immediately
    const { tasks, pendingDelete } = get();

    // Clear any existing pending delete
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
    }

    set({ tasks: tasks.filter((t) => t.id !== id && t.parent_task_id !== id) });

    const timeoutId = window.setTimeout(async () => {
      try {
        await invoke<void>("delete_task", { id });
      } catch {
        // If delete fails, reload to restore state
      }
      set({ pendingDelete: null });
      await get().loadTasks();
    }, 10_000);

    set({ pendingDelete: { taskId: id, timeoutId } });

    toast("Task deleted", {
      action: {
        label: "Undo",
        onClick: () => get().undoDelete(),
      },
      duration: 10_000,
    });
  },

  undoDelete: () => {
    const { pendingDelete } = get();
    if (pendingDelete) {
      clearTimeout(pendingDelete.timeoutId);
      set({ pendingDelete: null });
      get().loadTasks();
    }
  },

  completeTask: async (id) => {
    await invoke<TaskFromBackend>("complete_task", { id });
    await get().loadTasks();
  },

  abandonTask: async (id) => {
    await invoke<TaskFromBackend>("abandon_task", { id });
    await get().loadTasks();
  },

  reopenTask: async (id) => {
    await invoke<TaskFromBackend>("reopen_task", { id });
    await get().loadTasks();
  },

  cloneTask: async (id) => {
    await invoke<TaskFromBackend>("clone_task", { id });
    await get().loadTasks();
  },

  reorderTasks: async (taskIds) => {
    await invoke<void>("reorder_tasks", { taskIds });
    await get().loadTasks();
  },

  openCreateDialog: (parentId?: number | null) => {
    set({ showCreateDialog: true, createParentId: parentId ?? null });
  },

  closeCreateDialog: () => {
    set({ showCreateDialog: false, createParentId: null });
  },

  openEditDialog: (task: Task) => {
    set({ showEditDialog: true, editTask: task });
  },

  closeEditDialog: () => {
    set({ showEditDialog: false, editTask: null });
  },
}));
