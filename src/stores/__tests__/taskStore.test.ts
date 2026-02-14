import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/lib/schemas";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("@/lib/settingsRepository", () => ({
  getAll: vi.fn(async () => []),
}));

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const { useTaskStore } = await import("../taskStore");

const makeBackendTask = (overrides = {}) => ({
  id: 1,
  title: "Test task",
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

describe("taskStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useTaskStore.setState({
      tasks: [],
      selectedDate: "2026-02-14",
      isLoading: false,
      showCreateDialog: false,
      createParentId: null,
      showEditDialog: false,
      editTask: null,
      pendingDelete: null,
      intervalCounts: {},
      daysWithTasks: [],
      originDates: {},
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("loadTasks", () => {
    it("fetches tasks, interval counts, and origin dates for the selected date", async () => {
      const tasks = [
        makeBackendTask(),
        makeBackendTask({ id: 2, position: 1 }),
      ];
      mockInvoke
        .mockResolvedValueOnce(tasks) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().loadTasks();

      expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
        dayDate: "2026-02-14",
      });
      expect(mockInvoke).toHaveBeenCalledWith("get_task_interval_counts", {
        dayDate: "2026-02-14",
      });
      expect(mockInvoke).toHaveBeenCalledWith("get_task_origin_dates", {
        dayDate: "2026-02-14",
      });
      expect(useTaskStore.getState().tasks).toHaveLength(2);
    });

    it("sets isLoading to false after fetch completes", async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().loadTasks();

      expect(useTaskStore.getState().isLoading).toBe(false);
    });

    it("stores interval counts from backend", async () => {
      mockInvoke
        .mockResolvedValueOnce([makeBackendTask()]) // get_tasks_by_date
        .mockResolvedValueOnce([
          { task_id: 1, count: 3 },
          { task_id: 2, count: 1 },
        ]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().loadTasks();

      const counts = useTaskStore.getState().intervalCounts;
      expect(counts[1]).toBe(3);
      expect(counts[2]).toBe(1);
    });

    it("stores origin dates from backend", async () => {
      mockInvoke
        .mockResolvedValueOnce([makeBackendTask()]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([{ task_id: 1, origin_day_date: "2026-02-13" }]); // get_task_origin_dates

      await useTaskStore.getState().loadTasks();

      const origins = useTaskStore.getState().originDates;
      expect(origins[1]).toBe("2026-02-13");
    });
  });

  describe("createTask", () => {
    it("calls create_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask()) // create_task
        .mockResolvedValueOnce([makeBackendTask()]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().createTask({
        title: "New task",
        tag: "dev",
        jiraKey: "PROJ-1",
      });

      expect(mockInvoke).toHaveBeenCalledWith("create_task", {
        title: "New task",
        dayDate: "2026-02-14",
        parentTaskId: null,
        jiraKey: "PROJ-1",
        tag: "dev",
      });
    });

    it("passes parentTaskId for subtasks", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ id: 2, parent_task_id: 1 }))
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().createTask({
        title: "Subtask",
        parentTaskId: 1,
      });

      expect(mockInvoke).toHaveBeenCalledWith("create_task", {
        title: "Subtask",
        dayDate: "2026-02-14",
        parentTaskId: 1,
        jiraKey: null,
        tag: null,
      });
    });
  });

  describe("deleteTask", () => {
    it("calls delete_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_task
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().deleteTask(5);

      expect(mockInvoke).toHaveBeenCalledWith("delete_task", { id: 5 });
    });
  });

  describe("completeTask", () => {
    it("calls complete_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ status: "completed" }))
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().completeTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("complete_task", { id: 1 });
    });
  });

  describe("abandonTask", () => {
    it("calls abandon_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ status: "abandoned" }))
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().abandonTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("abandon_task", { id: 1 });
    });
  });

  describe("reopenTask", () => {
    it("calls reopen_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ status: "pending" }))
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().reopenTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("reopen_task", { id: 1 });
    });
  });

  describe("cloneTask", () => {
    it("calls clone_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ id: 2 }))
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().cloneTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("clone_task", { id: 1 });
    });
  });

  describe("copyTaskToDay", () => {
    it("calls copy_task_to_day and shows toast", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ id: 2 })) // copy_task_to_day
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().copyTaskToDay(1, "2026-02-14");

      expect(mockInvoke).toHaveBeenCalledWith("copy_task_to_day", {
        id: 1,
        targetDate: "2026-02-14",
      });
      const { toast } = await import("sonner");
      expect(toast).toHaveBeenCalledWith("Task copied to today");
    });
  });

  describe("loadDaysWithTasks", () => {
    it("stores days with tasks from backend", async () => {
      mockInvoke.mockResolvedValueOnce(["2026-02-13", "2026-02-14"]);

      await useTaskStore
        .getState()
        .loadDaysWithTasks("2026-02-01", "2026-02-28");

      expect(mockInvoke).toHaveBeenCalledWith("get_days_with_tasks", {
        startDate: "2026-02-01",
        endDate: "2026-02-28",
      });
      expect(useTaskStore.getState().daysWithTasks).toEqual([
        "2026-02-13",
        "2026-02-14",
      ]);
    });
  });

  describe("reorderTasks", () => {
    it("calls reorder_tasks with task IDs", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // reorder_tasks
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().reorderTasks([3, 1, 2]);

      expect(mockInvoke).toHaveBeenCalledWith("reorder_tasks", {
        taskIds: [3, 1, 2],
      });
    });
  });

  describe("updateTask", () => {
    it("calls update_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ title: "Updated" }))
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().updateTask(1, { title: "Updated" });

      expect(mockInvoke).toHaveBeenCalledWith("update_task", {
        id: 1,
        title: "Updated",
        jiraKey: null,
        tag: null,
      });
    });
  });

  describe("dialog state", () => {
    it("opens create dialog", () => {
      useTaskStore.getState().openCreateDialog();
      expect(useTaskStore.getState().showCreateDialog).toBe(true);
      expect(useTaskStore.getState().createParentId).toBeNull();
    });

    it("opens create dialog with parent ID for subtask", () => {
      useTaskStore.getState().openCreateDialog(5);
      expect(useTaskStore.getState().showCreateDialog).toBe(true);
      expect(useTaskStore.getState().createParentId).toBe(5);
    });

    it("closes create dialog and resets parent", () => {
      useTaskStore.getState().openCreateDialog(5);
      useTaskStore.getState().closeCreateDialog();
      expect(useTaskStore.getState().showCreateDialog).toBe(false);
      expect(useTaskStore.getState().createParentId).toBeNull();
    });
  });

  describe("edit dialog state", () => {
    it("opens edit dialog with task data", () => {
      const task = makeBackendTask({ id: 3, title: "Edit me", tag: "dev" });
      useTaskStore.getState().openEditDialog(task as Task);
      expect(useTaskStore.getState().showEditDialog).toBe(true);
      expect(useTaskStore.getState().editTask?.id).toBe(3);
      expect(useTaskStore.getState().editTask?.title).toBe("Edit me");
    });

    it("closes edit dialog and clears task", () => {
      const task = makeBackendTask({ id: 3 });
      useTaskStore.getState().openEditDialog(task as Task);
      useTaskStore.getState().closeEditDialog();
      expect(useTaskStore.getState().showEditDialog).toBe(false);
      expect(useTaskStore.getState().editTask).toBeNull();
    });
  });

  describe("softDeleteTask", () => {
    it("removes task from UI immediately", () => {
      useTaskStore.setState({
        tasks: [
          makeBackendTask({ id: 1 }),
          makeBackendTask({ id: 2, position: 1 }),
        ] as Task[],
      });

      useTaskStore.getState().softDeleteTask(1);

      const tasks = useTaskStore.getState().tasks;
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe(2);
    });

    it("sets pending delete state", () => {
      useTaskStore.setState({ tasks: [makeBackendTask()] as Task[] });

      useTaskStore.getState().softDeleteTask(1);

      expect(useTaskStore.getState().pendingDelete).not.toBeNull();
      expect(useTaskStore.getState().pendingDelete?.taskId).toBe(1);
    });

    it("does not call invoke immediately", () => {
      useTaskStore.setState({ tasks: [makeBackendTask()] as Task[] });

      useTaskStore.getState().softDeleteTask(1);

      expect(mockInvoke).not.toHaveBeenCalledWith("delete_task", { id: 1 });
    });

    it("calls delete_task after timeout", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // delete_task
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates
      useTaskStore.setState({ tasks: [makeBackendTask()] as Task[] });

      useTaskStore.getState().softDeleteTask(1);

      vi.advanceTimersByTime(10_000);
      await vi.runAllTimersAsync();

      expect(mockInvoke).toHaveBeenCalledWith("delete_task", { id: 1 });
    });
  });

  describe("undoDelete", () => {
    it("cancels pending delete and reloads tasks", async () => {
      mockInvoke
        .mockResolvedValueOnce([makeBackendTask()]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates
      useTaskStore.setState({ tasks: [makeBackendTask()] as Task[] });

      useTaskStore.getState().softDeleteTask(1);
      useTaskStore.getState().undoDelete();

      expect(useTaskStore.getState().pendingDelete).toBeNull();

      // Advance timers — delete should NOT fire
      vi.advanceTimersByTime(10_000);
      await vi.runAllTimersAsync();

      expect(mockInvoke).not.toHaveBeenCalledWith("delete_task", { id: 1 });
    });
  });

  describe("setSelectedDate", () => {
    it("changes date and reloads tasks", async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // get_tasks_by_date
        .mockResolvedValueOnce([]) // get_task_interval_counts
        .mockResolvedValueOnce([]); // get_task_origin_dates

      await useTaskStore.getState().setSelectedDate("2026-02-15");

      expect(useTaskStore.getState().selectedDate).toBe("2026-02-15");
      expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
        dayDate: "2026-02-15",
      });
    });
  });
});
