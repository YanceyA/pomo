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
  completed_in_pomodoro: null,
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
      completedWorkCount: 2,
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

  it("shows dialog title as 'Complete Tasks'", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    render(<IntervalAssociationDialog />);
    expect(screen.getByText("Complete Tasks")).toBeInTheDocument();
  });

  it("shows 'No tasks for today' when no pending tasks exist", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    render(<IntervalAssociationDialog />);
    expect(screen.getByTestId("association-no-tasks")).toHaveTextContent(
      "No tasks for today.",
    );
  });

  it("only shows pending parent tasks, filters completed and abandoned", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Pending task" }),
        makeTask({ id: 2, title: "Completed task", status: "completed" }),
        makeTask({ id: 3, title: "Abandoned task", status: "abandoned" }),
        makeTask({ id: 4, title: "Another pending", position: 1 }),
      ],
    });
    render(<IntervalAssociationDialog />);

    expect(screen.getByTestId("association-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("association-task-4")).toBeInTheDocument();
    expect(screen.queryByTestId("association-task-2")).not.toBeInTheDocument();
    expect(screen.queryByTestId("association-task-3")).not.toBeInTheDocument();
  });

  it("renders pending subtasks nested under parents", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent" }),
        makeTask({
          id: 2,
          title: "Pending subtask",
          parent_task_id: 1,
          position: 0,
        }),
        makeTask({
          id: 3,
          title: "Completed subtask",
          parent_task_id: 1,
          status: "completed",
          position: 1,
        }),
      ],
    });
    render(<IntervalAssociationDialog />);

    expect(screen.getByTestId("association-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("association-subtask-2")).toBeInTheDocument();
    // Completed subtask should not appear
    expect(
      screen.queryByTestId("association-subtask-3"),
    ).not.toBeInTheDocument();
  });

  it("does not show subtasks as parent tasks", () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent" }),
        makeTask({
          id: 2,
          title: "Subtask",
          parent_task_id: 1,
        }),
      ],
    });
    render(<IntervalAssociationDialog />);

    expect(screen.getByTestId("association-task-1")).toBeInTheDocument();
    // Subtask should not appear as a parent-level task
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

  it("checking parent auto-checks all pending subtasks", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent" }),
        makeTask({ id: 2, title: "Sub 1", parent_task_id: 1 }),
        makeTask({ id: 3, title: "Sub 2", parent_task_id: 1, position: 1 }),
      ],
    });

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    await user.click(screen.getByTestId("association-task-1"));

    expect(screen.getByTestId("association-checkbox-1")).toHaveAttribute(
      "data-state",
      "checked",
    );
    expect(
      screen.getByTestId("association-subtask-checkbox-2"),
    ).toHaveAttribute("data-state", "checked");
    expect(
      screen.getByTestId("association-subtask-checkbox-3"),
    ).toHaveAttribute("data-state", "checked");
  });

  it("unchecking parent unchecks all subtasks", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent" }),
        makeTask({ id: 2, title: "Sub 1", parent_task_id: 1 }),
      ],
    });

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    // Check parent (also checks subtask)
    await user.click(screen.getByTestId("association-task-1"));
    expect(
      screen.getByTestId("association-subtask-checkbox-2"),
    ).toHaveAttribute("data-state", "checked");

    // Uncheck parent
    await user.click(screen.getByTestId("association-task-1"));
    expect(
      screen.getByTestId("association-subtask-checkbox-2"),
    ).toHaveAttribute("data-state", "unchecked");
  });

  it("checking all subtasks auto-checks parent", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent" }),
        makeTask({ id: 2, title: "Sub 1", parent_task_id: 1 }),
        makeTask({ id: 3, title: "Sub 2", parent_task_id: 1, position: 1 }),
      ],
    });

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    // Check first subtask — parent should remain unchecked
    await user.click(screen.getByTestId("association-subtask-2"));
    expect(screen.getByTestId("association-checkbox-1")).toHaveAttribute(
      "data-state",
      "unchecked",
    );

    // Check second subtask — parent should auto-check
    await user.click(screen.getByTestId("association-subtask-3"));
    expect(screen.getByTestId("association-checkbox-1")).toHaveAttribute(
      "data-state",
      "checked",
    );
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

  it("confirm calls complete_task for selected tasks (subtasks before parents)", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
      completedWorkCount: 3,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Parent" }),
        makeTask({ id: 2, title: "Sub 1", parent_task_id: 1 }),
      ],
    });

    mockInvoke.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    // Check parent (auto-checks subtask too)
    await user.click(screen.getByTestId("association-task-1"));
    await user.click(screen.getByTestId("association-confirm"));

    await waitFor(() => {
      // Subtask completed first
      expect(mockInvoke).toHaveBeenCalledWith("complete_task", {
        id: 2,
        pomodoroNumber: 3,
      });
      // Then parent
      expect(mockInvoke).toHaveBeenCalledWith("complete_task", {
        id: 1,
        pomodoroNumber: 3,
      });
    });
  });

  it("confirm passes pomodoroNumber from completedWorkCount", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
      completedWorkCount: 5,
    });
    useTaskStore.setState({
      tasks: [makeTask({ id: 1, title: "A task" })],
    });

    mockInvoke.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    await user.click(screen.getByTestId("association-task-1"));
    await user.click(screen.getByTestId("association-confirm"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("complete_task", {
        id: 1,
        pomodoroNumber: 5,
      });
    });
  });

  it("clicking Confirm calls link_tasks_to_interval", async () => {
    useTimerStore.setState({
      showAssociationDialog: true,
      lastCompletedIntervalId: 42,
      completedWorkCount: 1,
    });
    useTaskStore.setState({
      tasks: [
        makeTask({ id: 1, title: "Task A" }),
        makeTask({ id: 3, title: "Task B", position: 1 }),
      ],
    });

    mockInvoke.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<IntervalAssociationDialog />);

    await user.click(screen.getByTestId("association-task-1"));
    await user.click(screen.getByTestId("association-task-3"));
    await user.click(screen.getByTestId("association-confirm"));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("link_tasks_to_interval", {
        taskIds: [1, 3],
        intervalId: 42,
      });
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
      completedWorkCount: 1,
    });
    useTaskStore.setState({
      tasks: [makeTask({ id: 1, title: "Task A" })],
    });

    mockInvoke.mockResolvedValue(undefined);

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
  });
});
