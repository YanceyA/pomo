import { GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface TaskPanelOverlayProps {
  task: Task;
  subtasks: Task[];
}

export function TaskPanelOverlay({ task, subtasks }: TaskPanelOverlayProps) {
  const isAbandoned = task.status === "abandoned";

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 shadow-lg",
        isAbandoned && "opacity-60",
      )}
      data-testid="task-drag-overlay"
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 text-muted-foreground">
          <GripVertical className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{task.title}</span>
            {task.tag && <Badge variant="secondary">{task.tag}</Badge>}
          </div>
          {subtasks.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {subtasks.length} subtask{subtasks.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
