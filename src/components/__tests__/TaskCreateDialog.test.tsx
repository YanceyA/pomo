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
const { TaskCreateDialog } = await import("../TaskCreateDialog");

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

describe("TaskCreateDialog", () => {
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
    });
  });

  it("is not visible when showCreateDialog is false", () => {
    render(<TaskCreateDialog />);
    expect(screen.queryByTestId("task-create-dialog")).not.toBeInTheDocument();
  });

  it("is visible when showCreateDialog is true", () => {
    useTaskStore.setState({ showCreateDialog: true });
    render(<TaskCreateDialog />);
    expect(screen.getByTestId("task-create-dialog")).toBeInTheDocument();
  });

  it("shows 'Create Task' title for parent tasks", () => {
    useTaskStore.setState({ showCreateDialog: true, createParentId: null });
    render(<TaskCreateDialog />);
    expect(
      screen.getByRole("heading", { name: "Create Task" }),
    ).toBeInTheDocument();
  });

  it("shows 'Add Subtask' title for subtasks", () => {
    useTaskStore.setState({ showCreateDialog: true, createParentId: 5 });
    render(<TaskCreateDialog />);
    expect(
      screen.getByRole("heading", { name: "Add Subtask" }),
    ).toBeInTheDocument();
  });

  it("hides tag and jira inputs for subtasks", () => {
    useTaskStore.setState({ showCreateDialog: true, createParentId: 5 });
    render(<TaskCreateDialog />);
    expect(screen.queryByTestId("task-tag-input")).not.toBeInTheDocument();
    expect(screen.queryByTestId("task-jira-input")).not.toBeInTheDocument();
  });

  it("shows tag and jira inputs for parent tasks", () => {
    useTaskStore.setState({ showCreateDialog: true, createParentId: null });
    render(<TaskCreateDialog />);
    expect(screen.getByTestId("task-tag-input")).toBeInTheDocument();
    expect(screen.getByTestId("task-jira-input")).toBeInTheDocument();
  });

  it("submit button is disabled when title is empty", () => {
    useTaskStore.setState({ showCreateDialog: true });
    render(<TaskCreateDialog />);
    expect(screen.getByTestId("task-create-submit")).toBeDisabled();
  });

  it("calls createTask with correct data on submit", async () => {
    useTaskStore.setState({ showCreateDialog: true, createParentId: null });
    mockInvoke
      .mockResolvedValueOnce({
        id: 1,
        title: "New task",
        status: "pending",
      })
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<TaskCreateDialog />);

    await user.type(screen.getByTestId("task-title-input"), "New task");
    await user.type(screen.getByTestId("task-tag-input"), "dev");
    await user.type(screen.getByTestId("task-jira-input"), "PROJ-42");
    await user.click(screen.getByTestId("task-create-submit"));

    expect(mockInvoke).toHaveBeenCalledWith("create_task", {
      title: "New task",
      dayDate: "2026-02-14",
      parentTaskId: null,
      jiraKey: "PROJ-42",
      tag: "dev",
    });
  });

  it("closes dialog after successful submit", async () => {
    useTaskStore.setState({ showCreateDialog: true });
    mockInvoke.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<TaskCreateDialog />);

    await user.type(screen.getByTestId("task-title-input"), "Task");
    await user.click(screen.getByTestId("task-create-submit"));

    expect(useTaskStore.getState().showCreateDialog).toBe(false);
  });

  // ── Edit mode tests ────────────────────────────────────

  it("shows 'Edit Task' title in edit mode", () => {
    useTaskStore.setState({
      showEditDialog: true,
      editTask: makeTask({ title: "Existing", tag: "dev" }),
    });
    render(<TaskCreateDialog />);
    expect(
      screen.getByRole("heading", { name: "Edit Task" }),
    ).toBeInTheDocument();
  });

  it("shows 'Edit Subtask' title when editing a subtask", () => {
    useTaskStore.setState({
      showEditDialog: true,
      editTask: makeTask({ parent_task_id: 5, title: "Sub" }),
    });
    render(<TaskCreateDialog />);
    expect(
      screen.getByRole("heading", { name: "Edit Subtask" }),
    ).toBeInTheDocument();
  });

  it("pre-populates fields from editTask", () => {
    useTaskStore.setState({
      showEditDialog: true,
      editTask: makeTask({
        title: "My task",
        tag: "design",
        jira_key: "LRE-5",
      }),
    });
    render(<TaskCreateDialog />);
    expect(screen.getByTestId("task-title-input")).toHaveValue("My task");
    expect(screen.getByTestId("task-tag-input")).toHaveValue("design");
    expect(screen.getByTestId("task-jira-input")).toHaveValue("LRE-5");
  });

  it("calls updateTask on submit in edit mode", async () => {
    useTaskStore.setState({
      showEditDialog: true,
      editTask: makeTask({ title: "Old title" }),
    });
    mockInvoke
      .mockResolvedValueOnce(makeTask({ title: "New title" }))
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<TaskCreateDialog />);

    const input = screen.getByTestId("task-title-input");
    await user.clear(input);
    await user.type(input, "New title");
    await user.click(screen.getByTestId("task-create-submit"));

    expect(mockInvoke).toHaveBeenCalledWith("update_task", {
      id: 1,
      title: "New title",
      jiraKey: null,
      tag: null,
    });
  });

  it("closes edit dialog after successful edit submit", async () => {
    useTaskStore.setState({
      showEditDialog: true,
      editTask: makeTask({ title: "Old" }),
    });
    mockInvoke.mockResolvedValueOnce(makeTask()).mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<TaskCreateDialog />);

    await user.click(screen.getByTestId("task-create-submit"));

    expect(useTaskStore.getState().showEditDialog).toBe(false);
    expect(useTaskStore.getState().editTask).toBeNull();
  });
});
