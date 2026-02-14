import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/stores/taskStore";

interface SubtaskItemProps {
  task: Task;
}

export function SubtaskItem({ task }: SubtaskItemProps) {
  const completeTask = useTaskStore((s) => s.completeTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const isCompleted = task.status === "completed";
  const isAbandoned = task.status === "abandoned";
  const isDone = isCompleted || isAbandoned;

  const handleToggle = async () => {
    if (!isDone) {
      await completeTask(task.id);
    }
  };

  return (
    <div
      className="flex items-center gap-2 py-1 pl-6"
      data-testid={`subtask-${task.id}`}
    >
      <Checkbox
        checked={isCompleted}
        onCheckedChange={handleToggle}
        disabled={isDone}
        data-testid={`subtask-checkbox-${task.id}`}
      />
      <span
        className={cn(
          "flex-1 text-sm",
          isCompleted && "text-muted-foreground line-through",
          isAbandoned && "text-muted-foreground italic line-through",
        )}
      >
        {task.title}
      </span>
      {task.jira_key && (
        <span className="text-xs text-muted-foreground">{task.jira_key}</span>
      )}
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => deleteTask(task.id)}
        data-testid={`subtask-delete-${task.id}`}
      >
        <Trash2 className="size-3" />
      </Button>
    </div>
  );
}
