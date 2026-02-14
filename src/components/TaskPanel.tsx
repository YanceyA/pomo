import { Check, Copy, ListPlus, MoreHorizontal, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { Task } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/stores/taskStore";
import { SubtaskItem } from "./SubtaskItem";

interface TaskPanelProps {
  task: Task;
  subtasks: Task[];
}

export function TaskPanel({ task, subtasks }: TaskPanelProps) {
  const completeTask = useTaskStore((s) => s.completeTask);
  const abandonTask = useTaskStore((s) => s.abandonTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);
  const cloneTask = useTaskStore((s) => s.cloneTask);
  const openCreateDialog = useTaskStore((s) => s.openCreateDialog);
  const [showActions, setShowActions] = useState(false);

  const isCompleted = task.status === "completed";
  const isAbandoned = task.status === "abandoned";
  const isDone = isCompleted || isAbandoned;

  const hasPendingSubtasks = subtasks.some((s) => s.status === "pending");

  const handleToggle = async () => {
    if (!isDone) {
      await completeTask(task.id);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        isAbandoned && "opacity-60",
      )}
      data-testid={`task-panel-${task.id}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggle}
          disabled={isDone || hasPendingSubtasks}
          className="mt-0.5"
          data-testid={`task-checkbox-${task.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium",
                isCompleted && "text-muted-foreground line-through",
                isAbandoned && "text-muted-foreground italic line-through",
              )}
              data-testid={`task-title-${task.id}`}
            >
              {task.title}
            </span>
            {task.tag && (
              <Badge variant="secondary" data-testid={`task-tag-${task.id}`}>
                {task.tag}
              </Badge>
            )}
            {isAbandoned && (
              <Badge
                variant="outline"
                className="text-muted-foreground"
                data-testid={`task-abandoned-badge-${task.id}`}
              >
                Abandoned
              </Badge>
            )}
          </div>
          {task.jira_key && (
            <span
              className="text-xs text-blue-600 hover:underline cursor-pointer"
              data-testid={`task-jira-${task.id}`}
            >
              {task.jira_key}
            </span>
          )}
          {/* Subtasks */}
          {subtasks.length > 0 && (
            <div
              className="mt-2 border-t pt-2"
              data-testid={`subtask-list-${task.id}`}
            >
              {subtasks.map((sub) => (
                <SubtaskItem key={sub.id} task={sub} />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setShowActions(!showActions)}
            data-testid={`task-actions-toggle-${task.id}`}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </div>
      </div>
      {showActions && (
        <div
          className="mt-2 flex flex-wrap gap-1 border-t pt-2"
          data-testid={`task-actions-${task.id}`}
        >
          {!isDone && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => openCreateDialog(task.id)}
              data-testid={`task-add-subtask-${task.id}`}
            >
              <ListPlus className="size-3" />
              Add Subtask
            </Button>
          )}
          {!isDone && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => abandonTask(task.id)}
              data-testid={`task-abandon-${task.id}`}
            >
              <X className="size-3" />
              Abandon
            </Button>
          )}
          {!isDone && !hasPendingSubtasks && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => completeTask(task.id)}
              data-testid={`task-complete-${task.id}`}
            >
              <Check className="size-3" />
              Complete
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            onClick={() => cloneTask(task.id)}
            data-testid={`task-clone-${task.id}`}
          >
            <Copy className="size-3" />
            Clone
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => deleteTask(task.id)}
            className="text-destructive hover:text-destructive"
            data-testid={`task-delete-${task.id}`}
          >
            <Trash2 className="size-3" />
            Delete
          </Button>
        </div>
      )}
    </div>
  );
}
