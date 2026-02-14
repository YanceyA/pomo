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
  ...overrides,
});

describe("TaskPanel", () => {
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

  it("renders task title", () => {
    render(<TaskPanel task={makeTask()} subtasks={[]} />);
    expect(screen.getByTestId("task-title-1")).toHaveTextContent("Test task");
  });

  it("renders tag badge when present", () => {
    render(<TaskPanel task={makeTask({ tag: "dev" })} subtasks={[]} />);
    expect(screen.getByTestId("task-tag-1")).toHaveTextContent("dev");
  });

  it("does not render tag badge when absent", () => {
    render(<TaskPanel task={makeTask()} subtasks={[]} />);
    expect(screen.queryByTestId("task-tag-1")).not.toBeInTheDocument();
  });

  it("renders Jira key when present", () => {
    render(
      <TaskPanel task={makeTask({ jira_key: "PROJ-123" })} subtasks={[]} />,
    );
    expect(screen.getByTestId("task-jira-1")).toHaveTextContent("PROJ-123");
  });

  it("renders subtasks", () => {
    const subtask = makeTask({
      id: 2,
      title: "Subtask 1",
      parent_task_id: 1,
    });
    render(<TaskPanel task={makeTask()} subtasks={[subtask]} />);
    expect(screen.getByTestId("subtask-2")).toBeInTheDocument();
  });

  it("shows abandoned badge for abandoned tasks", () => {
    render(
      <TaskPanel task={makeTask({ status: "abandoned" })} subtasks={[]} />,
    );
    expect(screen.getByTestId("task-abandoned-badge-1")).toBeInTheDocument();
  });

  it("disables checkbox when task has pending subtasks", () => {
    const subtask = makeTask({
      id: 2,
      title: "Subtask",
      status: "pending",
      parent_task_id: 1,
    });
    render(<TaskPanel task={makeTask()} subtasks={[subtask]} />);
    const checkbox = screen.getByTestId("task-checkbox-1");
    expect(checkbox).toBeDisabled();
  });

  it("toggles actions menu on click", async () => {
    const user = userEvent.setup();
    render(<TaskPanel task={makeTask()} subtasks={[]} />);

    expect(screen.queryByTestId("task-actions-1")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    expect(screen.getByTestId("task-actions-1")).toBeInTheDocument();
  });

  it("calls completeTask when checkbox is clicked", async () => {
    mockInvoke.mockResolvedValue(makeTask({ status: "completed" }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<TaskPanel task={makeTask()} subtasks={[]} />);

    await user.click(screen.getByTestId("task-checkbox-1"));

    expect(mockInvoke).toHaveBeenCalledWith("complete_task", { id: 1 });
  });

  it("calls deleteTask from actions menu", async () => {
    mockInvoke.mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<TaskPanel task={makeTask()} subtasks={[]} />);

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-delete-1"));

    expect(mockInvoke).toHaveBeenCalledWith("delete_task", { id: 1 });
  });

  it("calls cloneTask from actions menu", async () => {
    mockInvoke.mockResolvedValue(makeTask({ id: 2 }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<TaskPanel task={makeTask()} subtasks={[]} />);

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-clone-1"));

    expect(mockInvoke).toHaveBeenCalledWith("clone_task", { id: 1 });
  });

  it("calls abandonTask from actions menu", async () => {
    mockInvoke.mockResolvedValue(makeTask({ status: "abandoned" }));
    mockInvoke.mockResolvedValue([]);

    const user = userEvent.setup();
    render(<TaskPanel task={makeTask()} subtasks={[]} />);

    await user.click(screen.getByTestId("task-actions-toggle-1"));
    await user.click(screen.getByTestId("task-abandon-1"));

    expect(mockInvoke).toHaveBeenCalledWith("abandon_task", { id: 1 });
  });
});
