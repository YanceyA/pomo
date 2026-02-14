import { DndContext } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { render, screen } from "@testing-library/react";
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

const { useTaskStore } = await import("@/stores/taskStore");
const { TaskPanel } = await import("../TaskPanel");

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

function renderWithDnd(
  task: ReturnType<typeof makeTask>,
  subtasks: ReturnType<typeof makeTask>[] = [],
) {
  return render(
    <DndContext>
      <SortableContext items={[task.id]} strategy={verticalListSortingStrategy}>
        <TaskPanel task={task} subtasks={subtasks} />
      </SortableContext>
    </DndContext>,
  );
}

describe("TaskPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders task title", () => {
    renderWithDnd(makeTask());
    expect(screen.getByTestId("task-title-1")).toHaveTextContent("Test task");
  });

  it("renders drag handle", () => {
    renderWithDnd(makeTask());
    expect(screen.getByTestId("task-drag-handle-1")).toBeInTheDocument();
  });

  it("renders tag badge when present", () => {
    renderWithDnd(makeTask({ tag: "dev" }));
    expect(screen.getByTestId("task-tag-1")).toHaveTextContent("dev");
  });

  it("does not render tag badge when absent", () => {
    renderWithDnd(makeTask());
    expect(screen.queryByTestId("task-tag-1")).not.toBeInTheDocument();
  });

  it("renders Jira key when present", () => {
    renderWithDnd(makeTask({ jira_key: "PROJ-123" }));
    expect(screen.getByTestId("task-jira-1")).toHaveTextContent("PROJ-123");
  });

  it("renders subtasks", () => {
    const subtask = makeTask({
      id: 2,
      title: "Subtask 1",
      parent_task_id: 1,
    });
    renderWithDnd(makeTask(), [subtask]);
    expect(screen.getByTestId("subtask-2")).toBeInTheDocument();
  });

  it("shows abandoned badge for abandoned tasks", () => {
    renderWithDnd(makeTask({ status: "abandoned" }));
    expect(screen.getByTestId("task-abandoned-badge-1")).toBeInTheDocument();
  });

  it("disables checkbox when task has pending subtasks", () => {
    const subtask = makeTask({
      id: 2,
      title: "Subtask",
      status: "pending",
      parent_task_id: 1,
    });
    renderWithDnd(makeTask(), [subtask]);
    const checkbox = screen.getByTestId("task-checkbox-1");
    expect(checkbox).toBeDisabled();
  });

  it("toggles actions menu on click", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask());

    expect(screen.queryByTestId("task-actions-1")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.getByTestId("task-actions-1")).toBeInTheDocument();
  });

  it("calls completeTask when checkbox is clicked on pending task", async () => {
    mockInvoke.mockResolvedValue(makeTask({ status: "completed" }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-checkbox-1"));

    expect(mockInvoke).toHaveBeenCalledWith("complete_task", {
      id: 1,
      pomodoroNumber: null,
    });
  });

  it("calls reopenTask when checkbox is clicked on completed task", async () => {
    mockInvoke.mockResolvedValue(makeTask({ status: "pending" }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    renderWithDnd(makeTask({ status: "completed" }));

    await user.click(screen.getByTestId("task-checkbox-1"));

    expect(mockInvoke).toHaveBeenCalledWith("reopen_task", { id: 1 });
  });

  it("calls softDeleteTask from actions menu (not invoke directly)", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-delete-1"));

    // softDeleteTask does NOT call invoke immediately
    expect(mockInvoke).not.toHaveBeenCalledWith("delete_task", { id: 1 });
  });

  it("calls cloneTask from actions menu", async () => {
    mockInvoke.mockResolvedValue(makeTask({ id: 2 }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-clone-1"));

    expect(mockInvoke).toHaveBeenCalledWith("clone_task", { id: 1 });
  });

  it("calls abandonTask from actions menu", async () => {
    mockInvoke.mockResolvedValue(makeTask({ status: "abandoned" }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-abandon-1"));

    expect(mockInvoke).toHaveBeenCalledWith("abandon_task", { id: 1 });
  });

  it("shows edit button in actions menu", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.getByTestId("task-edit-1")).toBeInTheDocument();
  });

  it("edit button opens edit dialog with task data", async () => {
    const user = userEvent.setup();
    const task = makeTask({ tag: "dev", jira_key: "PROJ-1" });
    renderWithDnd(task);

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-edit-1"));

    expect(useTaskStore.getState().showEditDialog).toBe(true);
    expect(useTaskStore.getState().editTask?.id).toBe(1);
  });

  it("shows Reopen for completed tasks", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask({ status: "completed" }));

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.getByTestId("task-reopen-1")).toBeInTheDocument();
  });

  it("shows Reopen for abandoned tasks", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask({ status: "abandoned" }));

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.getByTestId("task-reopen-1")).toBeInTheDocument();
  });

  it("hides delete button for completed tasks", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask({ status: "completed" }));

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.queryByTestId("task-delete-1")).not.toBeInTheDocument();
  });

  it("hides delete button for abandoned tasks", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask({ status: "abandoned" }));

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.queryByTestId("task-delete-1")).not.toBeInTheDocument();
  });

  it("hides Abandon and Complete for completed tasks", async () => {
    const user = userEvent.setup();
    renderWithDnd(makeTask({ status: "completed" }));

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.queryByTestId("task-abandon-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-complete-1")).not.toBeInTheDocument();
  });

  it("shows 'Pomodoro N' when completed_in_pomodoro is set", () => {
    renderWithDnd(makeTask({ completed_in_pomodoro: 3 }));
    expect(screen.getByTestId("task-pomodoro-number-1")).toHaveTextContent(
      "Pomodoro 3",
    );
  });

  it("hides pomodoro number when completed_in_pomodoro is null", () => {
    renderWithDnd(makeTask({ completed_in_pomodoro: null }));
    expect(
      screen.queryByTestId("task-pomodoro-number-1"),
    ).not.toBeInTheDocument();
  });

  it("shows 'Copy to Today' when viewing a past day", async () => {
    const user = userEvent.setup();
    useTaskStore.setState({ selectedDate: "2020-01-01" });
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.getByTestId("task-copy-to-today-1")).toBeInTheDocument();
  });

  it("hides 'Copy to Today' when viewing today", async () => {
    const user = userEvent.setup();
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    useTaskStore.setState({ selectedDate: `${year}-${month}-${day}` });
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(
      screen.queryByTestId("task-copy-to-today-1"),
    ).not.toBeInTheDocument();
  });

  it("clicking 'Copy to Today' calls copy_task_to_day", async () => {
    mockInvoke.mockResolvedValue(makeTask({ id: 2 }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    useTaskStore.setState({ selectedDate: "2020-01-01" });
    renderWithDnd(makeTask());

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-copy-to-today-1"));

    expect(mockInvoke).toHaveBeenCalledWith(
      "copy_task_to_day",
      expect.objectContaining({ id: 1 }),
    );
  });

  it("shows 'Copied from' indicator when origin date exists", () => {
    useTaskStore.setState({ originDates: { 1: "2026-02-13" } });
    renderWithDnd(makeTask());
    const originEl = screen.getByTestId("task-origin-1");
    expect(originEl).toBeInTheDocument();
    expect(originEl.textContent).toContain("Copied from");
    expect(originEl.textContent).toContain("Feb");
    expect(originEl.textContent).toContain("13");
  });

  it("hides 'Copied from' when no origin date", () => {
    useTaskStore.setState({ originDates: {} });
    renderWithDnd(makeTask());
    expect(screen.queryByTestId("task-origin-1")).not.toBeInTheDocument();
  });
});
