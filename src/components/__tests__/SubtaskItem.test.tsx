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
const { SubtaskItem } = await import("../SubtaskItem");

const makeSubtask = (overrides = {}) => ({
  id: 2,
  title: "Subtask 1",
  day_date: "2026-02-14",
  status: "pending" as const,
  parent_task_id: 1,
  linked_from_task_id: null,
  jira_key: null,
  tag: null,
  position: 0,
  created_at: "2026-02-14T09:00:00Z",
  updated_at: "2026-02-14T09:00:00Z",
  completed_in_pomodoro: null,
  ...overrides,
});

describe("SubtaskItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTaskStore.setState({
      tasks: [],
      selectedDate: "2026-02-14",
      isLoading: false,
      showEditDialog: false,
      editTask: null,
      pendingDelete: null,
    });
  });

  it("renders subtask title", () => {
    render(<SubtaskItem task={makeSubtask()} />);
    expect(screen.getByText("Subtask 1")).toBeInTheDocument();
  });

  it("renders unchecked checkbox for pending subtask", () => {
    render(<SubtaskItem task={makeSubtask()} />);
    const checkbox = screen.getByTestId("subtask-checkbox-2");
    expect(checkbox).not.toBeDisabled();
    expect(checkbox).toHaveAttribute("data-state", "unchecked");
  });

  it("renders checked checkbox for completed subtask", () => {
    render(<SubtaskItem task={makeSubtask({ status: "completed" })} />);
    const checkbox = screen.getByTestId("subtask-checkbox-2");
    expect(checkbox).toHaveAttribute("data-state", "checked");
  });

  it("calls completeTask when checkbox is clicked on pending subtask", async () => {
    mockInvoke
      .mockResolvedValueOnce(makeSubtask({ status: "completed" }))
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<SubtaskItem task={makeSubtask()} />);

    await user.click(screen.getByTestId("subtask-checkbox-2"));

    expect(mockInvoke).toHaveBeenCalledWith("complete_task", {
      id: 2,
      pomodoroNumber: null,
    });
  });

  it("calls reopenTask when checkbox is clicked on completed subtask", async () => {
    mockInvoke
      .mockResolvedValueOnce(makeSubtask({ status: "pending" }))
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<SubtaskItem task={makeSubtask({ status: "completed" })} />);

    await user.click(screen.getByTestId("subtask-checkbox-2"));

    expect(mockInvoke).toHaveBeenCalledWith("reopen_task", { id: 2 });
  });

  it("calls softDeleteTask when delete button is clicked (not invoke directly)", async () => {
    const user = userEvent.setup();
    render(<SubtaskItem task={makeSubtask()} />);

    await user.click(screen.getByTestId("subtask-delete-2"));

    // softDeleteTask does NOT call invoke immediately
    expect(mockInvoke).not.toHaveBeenCalledWith("delete_task", { id: 2 });
  });

  it("shows jira key when present", () => {
    render(<SubtaskItem task={makeSubtask({ jira_key: "PROJ-1" })} />);
    expect(screen.getByText("PROJ-1")).toBeInTheDocument();
  });

  it("applies line-through style when completed", () => {
    render(<SubtaskItem task={makeSubtask({ status: "completed" })} />);
    const title = screen.getByText("Subtask 1");
    expect(title.className).toContain("line-through");
  });

  it("hides delete button for completed subtasks", () => {
    render(<SubtaskItem task={makeSubtask({ status: "completed" })} />);
    expect(screen.queryByTestId("subtask-delete-2")).not.toBeInTheDocument();
  });

  it("hides delete button for abandoned subtasks", () => {
    render(<SubtaskItem task={makeSubtask({ status: "abandoned" })} />);
    expect(screen.queryByTestId("subtask-delete-2")).not.toBeInTheDocument();
  });

  it("shows edit button for pending subtasks", () => {
    render(<SubtaskItem task={makeSubtask()} />);
    expect(screen.getByTestId("subtask-edit-2")).toBeInTheDocument();
  });

  it("hides edit button for completed subtasks", () => {
    render(<SubtaskItem task={makeSubtask({ status: "completed" })} />);
    expect(screen.queryByTestId("subtask-edit-2")).not.toBeInTheDocument();
  });

  it("inline edit: click edit shows input", async () => {
    const user = userEvent.setup();
    render(<SubtaskItem task={makeSubtask()} />);

    await user.click(screen.getByTestId("subtask-edit-2"));

    expect(screen.getByTestId("subtask-edit-input-2")).toBeInTheDocument();
  });

  it("inline edit: blur saves changed title", async () => {
    mockInvoke
      .mockResolvedValueOnce(makeSubtask({ title: "Updated" }))
      .mockResolvedValueOnce([]);

    const user = userEvent.setup();
    render(<SubtaskItem task={makeSubtask()} />);

    await user.click(screen.getByTestId("subtask-edit-2"));
    const input = screen.getByTestId("subtask-edit-input-2");
    await user.clear(input);
    await user.type(input, "Updated");
    await user.tab(); // triggers blur

    expect(mockInvoke).toHaveBeenCalledWith("update_task", {
      id: 2,
      title: "Updated",
      jiraKey: null,
      tag: null,
    });
  });

  it("inline edit: Escape cancels edit", async () => {
    const user = userEvent.setup();
    render(<SubtaskItem task={makeSubtask()} />);

    await user.click(screen.getByTestId("subtask-edit-2"));
    expect(screen.getByTestId("subtask-edit-input-2")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByTestId("subtask-edit-input-2"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Subtask 1")).toBeInTheDocument();
  });
});
