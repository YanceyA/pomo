import { beforeEach, describe, expect, it, vi } from "vitest";

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
    useTaskStore.setState({
      tasks: [],
      selectedDate: "2026-02-14",
      isLoading: false,
      showCreateDialog: false,
      createParentId: null,
    });
  });

  describe("loadTasks", () => {
    it("fetches tasks for the selected date", async () => {
      const tasks = [
        makeBackendTask(),
        makeBackendTask({ id: 2, position: 1 }),
      ];
      mockInvoke.mockResolvedValue(tasks);

      await useTaskStore.getState().loadTasks();

      expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
        dayDate: "2026-02-14",
      });
      expect(useTaskStore.getState().tasks).toHaveLength(2);
    });

    it("sets isLoading to false after fetch completes", async () => {
      mockInvoke.mockResolvedValue([]);

      await useTaskStore.getState().loadTasks();

      expect(useTaskStore.getState().isLoading).toBe(false);
    });
  });

  describe("createTask", () => {
    it("calls create_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask()) // create_task
        .mockResolvedValueOnce([makeBackendTask()]); // get_tasks_by_date

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
        .mockResolvedValueOnce([]);

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
        .mockResolvedValueOnce([]); // get_tasks_by_date

      await useTaskStore.getState().deleteTask(5);

      expect(mockInvoke).toHaveBeenCalledWith("delete_task", { id: 5 });
    });
  });

  describe("completeTask", () => {
    it("calls complete_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ status: "completed" }))
        .mockResolvedValueOnce([]);

      await useTaskStore.getState().completeTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("complete_task", { id: 1 });
    });
  });

  describe("abandonTask", () => {
    it("calls abandon_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ status: "abandoned" }))
        .mockResolvedValueOnce([]);

      await useTaskStore.getState().abandonTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("abandon_task", { id: 1 });
    });
  });

  describe("cloneTask", () => {
    it("calls clone_task and reloads", async () => {
      mockInvoke
        .mockResolvedValueOnce(makeBackendTask({ id: 2 }))
        .mockResolvedValueOnce([]);

      await useTaskStore.getState().cloneTask(1);

      expect(mockInvoke).toHaveBeenCalledWith("clone_task", { id: 1 });
    });
  });

  describe("reorderTasks", () => {
    it("calls reorder_tasks with task IDs", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // reorder_tasks
        .mockResolvedValueOnce([]); // get_tasks_by_date

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
        .mockResolvedValueOnce([]);

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

  describe("setSelectedDate", () => {
    it("changes date and reloads tasks", async () => {
      mockInvoke.mockResolvedValue([]);

      await useTaskStore.getState().setSelectedDate("2026-02-15");

      expect(useTaskStore.getState().selectedDate).toBe("2026-02-15");
      expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
        dayDate: "2026-02-15",
      });
    });
  });
});
