import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTaskStore } from "@/stores/taskStore";
import { useTimerStore } from "@/stores/timerStore";

export function IntervalAssociationDialog() {
  const showAssociationDialog = useTimerStore((s) => s.showAssociationDialog);
  const lastCompletedIntervalId = useTimerStore(
    (s) => s.lastCompletedIntervalId,
  );
  const dismissAssociationDialog = useTimerStore(
    (s) => s.dismissAssociationDialog,
  );

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);

  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only show parent tasks (not subtasks)
  const parentTasks = tasks.filter((t) => t.parent_task_id === null);

  const handleToggle = (taskId: number) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const handleConfirm = async () => {
    if (selectedTaskIds.length === 0 || lastCompletedIntervalId === null) {
      handleDismiss();
      return;
    }

    setIsSubmitting(true);
    try {
      await invoke("link_tasks_to_interval", {
        taskIds: selectedTaskIds,
        intervalId: lastCompletedIntervalId,
      });
      await loadTasks();
    } catch {
      // Silently fail — links are non-critical
    }
    setIsSubmitting(false);
    handleDismiss();
  };

  const handleDismiss = () => {
    setSelectedTaskIds([]);
    dismissAssociationDialog();
  };

  return (
    <Dialog open={showAssociationDialog} onOpenChange={() => handleDismiss()}>
      <DialogContent data-testid="association-dialog">
        <DialogHeader>
          <DialogTitle>Log Pomodoro</DialogTitle>
          <DialogDescription>
            Which tasks did you work on during this pomodoro?
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto py-2">
          {parentTasks.length === 0 && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="association-no-tasks"
            >
              No tasks for today.
            </p>
          )}
          {parentTasks.map((task) => (
            // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: Checkbox inside handles keyboard; row click is convenience
            <div
              key={task.id}
              className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent"
              data-testid={`association-task-${task.id}`}
              onClick={() => handleToggle(task.id)}
            >
              <Checkbox
                checked={selectedTaskIds.includes(task.id)}
                onCheckedChange={() => handleToggle(task.id)}
                data-testid={`association-checkbox-${task.id}`}
              />
              <span className="text-sm">{task.title}</span>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleDismiss}
            data-testid="association-skip"
          >
            Skip
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || selectedTaskIds.length === 0}
            data-testid="association-confirm"
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
