import { act, render, screen } from "@testing-library/react";
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
const { TaskList } = await import("../TaskList");

const makeTask = (overrides = {}) => ({
  id: 1,
  title: "Task 1",
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

describe("TaskList", () => {
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

  it("renders sortable items in correct order", async () => {
    const tasks = [
      makeTask({ id: 1, title: "First", position: 0 }),
      makeTask({ id: 2, title: "Second", position: 1 }),
      makeTask({ id: 3, title: "Third", position: 2 }),
    ];
    mockInvoke.mockResolvedValue(tasks);
    useTaskStore.setState({ tasks });

    await act(async () => {
      render(<TaskList />);
    });

    const panels = screen.getAllByTestId(/^task-panel-/);
    expect(panels).toHaveLength(3);
    expect(panels[0]).toHaveAttribute("data-testid", "task-panel-1");
    expect(panels[1]).toHaveAttribute("data-testid", "task-panel-2");
    expect(panels[2]).toHaveAttribute("data-testid", "task-panel-3");
  });

  it("renders drag handles for each task", async () => {
    const tasks = [
      makeTask({ id: 1, title: "Task A", position: 0 }),
      makeTask({ id: 2, title: "Task B", position: 1 }),
    ];
    mockInvoke.mockResolvedValue(tasks);
    useTaskStore.setState({ tasks });

    await act(async () => {
      render(<TaskList />);
    });

    expect(screen.getByTestId("task-drag-handle-1")).toBeInTheDocument();
    expect(screen.getByTestId("task-drag-handle-2")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", async () => {
    mockInvoke.mockResolvedValue([]);

    await act(async () => {
      render(<TaskList />);
    });

    expect(screen.getByTestId("tasks-empty")).toBeInTheDocument();
  });

  it("filters subtasks from parent list", async () => {
    const tasks = [
      makeTask({ id: 1, title: "Parent", position: 0 }),
      makeTask({
        id: 2,
        title: "Subtask",
        parent_task_id: 1,
        position: 0,
      }),
    ];
    mockInvoke.mockResolvedValue(tasks);
    useTaskStore.setState({ tasks });

    await act(async () => {
      render(<TaskList />);
    });

    // Only 1 top-level panel
    const panels = screen.getAllByTestId(/^task-panel-/);
    expect(panels).toHaveLength(1);
    expect(panels[0]).toHaveAttribute("data-testid", "task-panel-1");

    // Subtask rendered inside the parent
    expect(screen.getByTestId("subtask-2")).toBeInTheDocument();
  });
});
