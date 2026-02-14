import { Pencil, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { Task } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/stores/taskStore";

interface SubtaskItemProps {
  task: Task;
}

export function SubtaskItem({ task }: SubtaskItemProps) {
  const completeTask = useTaskStore((s) => s.completeTask);
  const reopenTask = useTaskStore((s) => s.reopenTask);
  const softDeleteTask = useTaskStore((s) => s.softDeleteTask);
  const updateTask = useTaskStore((s) => s.updateTask);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCompleted = task.status === "completed";
  const isAbandoned = task.status === "abandoned";
  const isPending = task.status === "pending";
  const isDone = isCompleted || isAbandoned;

  const handleToggle = async () => {
    if (isCompleted) {
      await reopenTask(task.id);
    } else if (isPending) {
      await completeTask(task.id);
    }
  };

  const startEditing = () => {
    setEditTitle(task.title);
    setIsEditingTitle(true);
    // Focus input on next tick after render
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const saveEdit = async () => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      await updateTask(task.id, { title: trimmed });
    }
    setIsEditingTitle(false);
  };

  const cancelEdit = () => {
    setEditTitle(task.title);
    setIsEditingTitle(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
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
        disabled={isAbandoned}
        data-testid={`subtask-checkbox-${task.id}`}
      />
      {isEditingTitle ? (
        <Input
          ref={inputRef}
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={handleKeyDown}
          className="h-7 flex-1 text-sm"
          data-testid={`subtask-edit-input-${task.id}`}
        />
      ) : (
        <span
          className={cn(
            "flex-1 text-sm",
            isCompleted && "text-muted-foreground line-through",
            isAbandoned && "text-muted-foreground italic line-through",
          )}
        >
          {task.title}
        </span>
      )}
      {task.jira_key && (
        <span className="text-xs text-muted-foreground">{task.jira_key}</span>
      )}
      {!isDone && !isEditingTitle && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={startEditing}
          data-testid={`subtask-edit-${task.id}`}
        >
          <Pencil className="size-3" />
        </Button>
      )}
      {isPending && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => softDeleteTask(task.id)}
          data-testid={`subtask-delete-${task.id}`}
        >
          <Trash2 className="size-3" />
        </Button>
      )}
    </div>
  );
}
