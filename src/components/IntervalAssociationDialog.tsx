import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
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
  const completedWorkCount = useTimerStore((s) => s.completedWorkCount);
  const dismissAssociationDialog = useTimerStore(
    (s) => s.dismissAssociationDialog,
  );

  const tasks = useTaskStore((s) => s.tasks);
  const loadTasks = useTaskStore((s) => s.loadTasks);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Only show pending tasks
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const pendingParents = pendingTasks.filter((t) => t.parent_task_id === null);
  const pendingSubtasksOf = useCallback(
    (parentId: number) =>
      pendingTasks.filter((t) => t.parent_task_id === parentId),
    [pendingTasks],
  );

  const handleToggleParent = (parentId: number) => {
    const subs = pendingSubtasksOf(parentId);
    const wasChecked = selectedIds.has(parentId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (wasChecked) {
        // Uncheck parent and all its subtasks
        next.delete(parentId);
        for (const sub of subs) {
          next.delete(sub.id);
        }
      } else {
        // Check parent and all its subtasks
        next.add(parentId);
        for (const sub of subs) {
          next.add(sub.id);
        }
      }
      return next;
    });
  };

  const handleToggleSubtask = (subtaskId: number, parentId: number) => {
    const subs = pendingSubtasksOf(parentId);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const wasChecked = next.has(subtaskId);
      if (wasChecked) {
        next.delete(subtaskId);
        // Uncheck parent if it was checked
        next.delete(parentId);
      } else {
        next.add(subtaskId);
        // If all subtasks are now checked, auto-check parent
        const allChecked = subs.every((s) =>
          s.id === subtaskId ? true : next.has(s.id),
        );
        if (allChecked) {
          next.add(parentId);
        }
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedIds.size === 0 || lastCompletedIntervalId === null) {
      handleDismiss();
      return;
    }

    setIsSubmitting(true);
    try {
      // For each checked parent, auto-complete any unchecked pending subtasks first
      for (const parent of pendingParents) {
        if (!selectedIds.has(parent.id)) continue;
        const subs = pendingSubtasksOf(parent.id);
        for (const sub of subs) {
          if (!selectedIds.has(sub.id)) {
            // Auto-complete unchecked pending subtask so parent can complete
            await invoke("complete_task", {
              id: sub.id,
              pomodoroNumber: completedWorkCount,
            });
          }
        }
      }

      // Complete subtasks first, then parents
      const subtaskIds = [...selectedIds].filter((id) =>
        pendingTasks.some((t) => t.id === id && t.parent_task_id !== null),
      );
      const parentIds = [...selectedIds].filter((id) =>
        pendingTasks.some((t) => t.id === id && t.parent_task_id === null),
      );

      for (const id of subtaskIds) {
        await invoke("complete_task", {
          id,
          pomodoroNumber: completedWorkCount,
        });
      }
      for (const id of parentIds) {
        await invoke("complete_task", {
          id,
          pomodoroNumber: completedWorkCount,
        });
      }

      // Link all completed tasks to the interval
      const allCompletedIds = [...subtaskIds, ...parentIds];
      await invoke("link_tasks_to_interval", {
        taskIds: allCompletedIds,
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
    setSelectedIds(new Set());
    dismissAssociationDialog();
  };

  return (
    <Dialog open={showAssociationDialog} onOpenChange={() => handleDismiss()}>
      <DialogContent data-testid="association-dialog">
        <DialogHeader>
          <DialogTitle>Complete Tasks</DialogTitle>
          <DialogDescription>
            Which tasks did you complete during this pomodoro?
          </DialogDescription>
        </DialogHeader>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto py-2">
          {pendingParents.length === 0 && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="association-no-tasks"
            >
              No tasks for today.
            </p>
          )}
          {pendingParents.map((task) => {
            const subs = pendingSubtasksOf(task.id);
            return (
              <div key={task.id}>
                {/* biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: Checkbox inside handles keyboard; row click is convenience */}
                <div
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                  data-testid={`association-task-${task.id}`}
                  onClick={() => handleToggleParent(task.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(task.id)}
                    onCheckedChange={() => handleToggleParent(task.id)}
                    data-testid={`association-checkbox-${task.id}`}
                  />
                  <span className="text-sm">{task.title}</span>
                </div>
                {subs.map((sub) => (
                  // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noStaticElementInteractions: Checkbox inside handles keyboard
                  <div
                    key={sub.id}
                    className="ml-6 flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-1 text-left hover:bg-accent"
                    data-testid={`association-subtask-${sub.id}`}
                    onClick={() => handleToggleSubtask(sub.id, task.id)}
                  >
                    <Checkbox
                      checked={selectedIds.has(sub.id)}
                      onCheckedChange={() =>
                        handleToggleSubtask(sub.id, task.id)
                      }
                      data-testid={`association-subtask-checkbox-${sub.id}`}
                    />
                    <span className="text-sm">{sub.title}</span>
                  </div>
                ))}
              </div>
            );
          })}
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
            disabled={isSubmitting || selectedIds.size === 0}
            data-testid="association-confirm"
          >
            {isSubmitting ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
