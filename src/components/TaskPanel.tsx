import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Copy,
  GripVertical,
  ListPlus,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
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
  const reopenTask = useTaskStore((s) => s.reopenTask);
  const softDeleteTask = useTaskStore((s) => s.softDeleteTask);
  const cloneTask = useTaskStore((s) => s.cloneTask);
  const openCreateDialog = useTaskStore((s) => s.openCreateDialog);
  const openEditDialog = useTaskStore((s) => s.openEditDialog);
  const [showActions, setShowActions] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isCompleted = task.status === "completed";
  const isAbandoned = task.status === "abandoned";
  const isPending = task.status === "pending";
  const isDone = isCompleted || isAbandoned;

  const hasPendingSubtasks = subtasks.some((s) => s.status === "pending");

  const handleToggle = async () => {
    if (isCompleted) {
      await reopenTask(task.id);
    } else if (isPending) {
      await completeTask(task.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm",
        isAbandoned && "opacity-60",
        isDragging && "opacity-50",
      )}
      data-testid={`task-panel-${task.id}`}
      {...attributes}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          data-testid={`task-drag-handle-${task.id}`}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <Checkbox
          checked={isCompleted}
          onCheckedChange={handleToggle}
          disabled={isAbandoned || (isPending && hasPendingSubtasks)}
          className="mt-0.5"
          data-testid={`task-checkbox-${task.id}`}
        />
        <div className="min-w-0 flex-1">
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
              className="cursor-pointer text-xs text-blue-600 hover:underline"
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
          <Button
            variant="ghost"
            size="xs"
            onClick={() => openEditDialog(task)}
            data-testid={`task-edit-${task.id}`}
          >
            <Pencil className="size-3" />
            Edit
          </Button>
          {isPending && (
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
          {isPending && (
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
          {isPending && !hasPendingSubtasks && (
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
          {isDone && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => reopenTask(task.id)}
              data-testid={`task-reopen-${task.id}`}
            >
              <RotateCcw className="size-3" />
              Reopen
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
          {isPending && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => softDeleteTask(task.id)}
              className="text-destructive hover:text-destructive"
              data-testid={`task-delete-${task.id}`}
            >
              <Trash2 className="size-3" />
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
