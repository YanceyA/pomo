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

const { useTaskStore } = await import("@/stores/taskStore");
const { TaskCreateDialog } = await import("../TaskCreateDialog");

describe("TaskCreateDialog", () => {
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
});
