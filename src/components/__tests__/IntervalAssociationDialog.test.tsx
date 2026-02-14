import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("sonner", () => ({
  toast: vi.fn(),
}));

const { useTimerStore } = await import("@/stores/timerStore");
const { useTaskStore } = await import("@/stores/taskStore");
const { IntervalAssociationDialog } = await import(
  "../IntervalAssociationDialog"
);

const makeTask = (overrides = {}) => ({
  id: 1,
  title: "Test task",
  day_date: "2026-02-14",
  status: "pending" as const,
  parent_task_id: null,
  linked_from_task_id: null,
  jira_key: null,
  tag: null,
  position: 0,
  created_at: "2026-02-14T09:00:00Z",
  updated_at: "2026-02-14T09:00:00Z",
  ...overrides,
});

describe("IntervalAssociationDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTimerStore.setState({
      state: "idle",
      intervalType: "work",
      remainingMs: 0,
      plannedDurationSeconds: 0,
      intervalId: null,
      completedWorkCount: 0,
      workDuration: 1500,
      shortBreakDuration: 300,
      longBreakDuration: 900,
      longBreakFrequency: 4,
      showCompletionNotice: false,
      completedIntervalType: null,
      showAssociationDialog: false,
      lastCompletedIntervalId: null,
      selectedType: "work",
    });
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
    });
  });

  it("does not render when showAssociationDialog is false", () => {
    render(<IntervalAssociationDialog />);
    expect(screen.queryByTestId("association-dialog")).not.toBeInTheDocument();
  });

  it("renders when showAssociationDialog is true", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    render(<IntervalAssociationDialog />);
    expect(screen.getByTestId("association-dialog")).toBeInTheDocument();
  });

  it("shows 'No tasks for today' when task list is empty", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    render(<IntervalAssociationDialog />);
    expect(screen.getByTestId("association-no-tasks")).toHaveTextContent(
      "No tasks for today.",
    );
  });

  it("renders parent tasks as checkboxes but not subtasks", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent task" }),
        makeTask({
          id: 2,
          title: "Subtask",
          parent_task_id: 1,
          position: 1,
        }),
        makeTask({ id: 3, title: "Another parent", position: 2 }),
      ],
    });
    render(<IntervalAssociationDialog />);

    expect(screen.getByTestId("association-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("association-task-3")).toBeInTheDocument();
    expect(screen.queryByTestId("association-task-2")).not.toBeInTheDocument();
  });

  it("clicking a task row toggles its checkbox", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [makeTask({ id: 1, title: "My task" })],
    });

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    const checkbox = screen.getByTestId("association-checkbox-1");
    expect(checkbox).toHaveAttribute("data-state", "unchecked");

    await user.click(screen.getByTestId("association-task-1"));
    expect(checkbox).toHaveAttribute("data-state", "checked");

    await user.click(screen.getByTestId("association-task-1"));
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  it("confirm button is disabled when no tasks are selected", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [makeTask({ id: 1, title: "A task" })],
    });
    render(<IntervalAssociationDialog />);

    expect(screen.getByTestId("association-confirm")).toBeDisabled();
  });

  it("clicking Confirm calls link_tasks_to_interval with selected task IDs and interval ID", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Task A" }),
        makeTask({ id: 3, title: "Task B", position: 1 }),
      ],
    });

    mockInvoke
      .mockResolvedValueOnce(undefined) // link_tasks_to_interval
      .mockResolvedValueOnce([]) // get_tasks_by_date (from loadTasks)
      .mockResolvedValueOnce([]); // get_task_interval_counts (from loadTasks)

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    await user.click(screen.getByTestId("association-task-1"));
    await user.click(screen.getByTestId("association-task-3"));
    await user.click(screen.getByTestId("association-confirm"));

    expect(mockInvoke).toHaveBeenCalledWith("link_tasks_to_interval", {
      taskIds: [1, 3],
      intervalId: 42,
    });
  });

  it("clicking Skip dismisses without linking", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [makeTask({ id: 1, title: "Task A" })],
    });

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    await user.click(screen.getByTestId("association-skip"));

    expect(mockInvoke).not.toHaveBeenCalledWith(
      "link_tasks_to_interval",
      expect.anything(),
    );
    expect(useTimerStore.getState().showAssociationDialog).toBe(false);
    expect(useTimerStore.getState().lastCompletedIntervalId).toBeNull();
  });

  it("after confirming, dialog is dismissed and tasks are reloaded", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [makeTask({ id: 1, title: "Task A" })],
    });

    mockInvoke
      .mockResolvedValueOnce(undefined) // link_tasks_to_interval
      .mockResolvedValueOnce([]) // get_tasks_by_date (from loadTasks)
      .mockResolvedValueOnce([]); // get_task_interval_counts (from loadTasks)

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    await user.click(screen.getByTestId("association-task-1"));
    await user.click(screen.getByTestId("association-confirm"));

    await waitFor(() => {
      expect(useTimerStore.getState().showAssociationDialog).toBe(false);
    });
    expect(useTimerStore.getState().lastCompletedIntervalId).toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith("get_tasks_by_date", {
      dayDate: "2026-02-14",
    });
    expect(mockInvoke).toHaveBeenCalledWith("get_task_interval_counts", {
      dayDate: "2026-02-14",
    });
  });
});
