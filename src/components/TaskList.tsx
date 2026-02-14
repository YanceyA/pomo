import { Plus } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/stores/taskStore";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskPanel } from "./TaskPanel";

export function TaskList() {
  const tasks = useTaskStore((s) => s.tasks);
  const selectedDate = useTaskStore((s) => s.selectedDate);
  const isLoading = useTaskStore((s) => s.isLoading);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const openCreateDialog = useTaskStore((s) => s.openCreateDialog);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Separate parent tasks and subtasks
  const parentTasks = tasks.filter((t) => t.parent_task_id === null);
  const getSubtasks = (parentId: number) =>
    tasks.filter((t) => t.parent_task_id === parentId);

  const formatDateHeader = (dateStr: string) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    if (dateStr === todayStr) return "Today";

    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" data-testid="task-date-header">
          {formatDateHeader(selectedDate)}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openCreateDialog()}
          data-testid="add-task-button"
        >
          <Plus className="size-4" />
          Add Task
        </Button>
      </div>

      {isLoading && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="tasks-loading"
        >
          Loading tasks...
        </p>
      )}

      {!isLoading && parentTasks.length === 0 && (
        <p
          className="py-8 text-center text-sm text-muted-foreground"
          data-testid="tasks-empty"
        >
          No tasks for this day. Click "Add Task" to get started.
        </p>
      )}

      {parentTasks.map((task) => (
        <TaskPanel key={task.id} task={task} subtasks={getSubtasks(task.id)} />
      ))}

      <TaskCreateDialog />
    </div>
  );
}
