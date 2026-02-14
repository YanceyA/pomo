import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTaskStore } from "@/stores/taskStore";

export function TaskCreateDialog() {
  const showCreateDialog = useTaskStore((s) => s.showCreateDialog);
  const createParentId = useTaskStore((s) => s.createParentId);
  const closeCreateDialog = useTaskStore((s) => s.closeCreateDialog);
  const createTask = useTaskStore((s) => s.createTask);

  const showEditDialog = useTaskStore((s) => s.showEditDialog);
  const editTask = useTaskStore((s) => s.editTask);
  const closeEditDialog = useTaskStore((s) => s.closeEditDialog);
  const updateTask = useTaskStore((s) => s.updateTask);

  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [jiraKey, setJiraKey] = useState("");

  const isEditing = showEditDialog && editTask !== null;
  const isOpen = showCreateDialog || isEditing;
  const isSubtask = isEditing
    ? editTask.parent_task_id !== null
    : createParentId !== null;

  // Pre-populate fields when editing
  useEffect(() => {
    if (isEditing) {
      setTitle(editTask.title);
      setTag(editTask.tag ?? "");
      setJiraKey(editTask.jira_key ?? "");
    }
  }, [isEditing, editTask]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEditing) {
      await updateTask(editTask.id, {
        title: title.trim(),
        tag: tag.trim() || null,
        jiraKey: jiraKey.trim() || null,
      });
      resetAndClose();
    } else {
      await createTask({
        title: title.trim(),
        tag: tag.trim() || null,
        jiraKey: jiraKey.trim() || null,
        parentTaskId: createParentId,
      });
      resetAndClose();
    }
  };

  const resetAndClose = () => {
    setTitle("");
    setTag("");
    setJiraKey("");
    if (isEditing) {
      closeEditDialog();
    } else {
      closeCreateDialog();
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetAndClose();
    }
  };

  const dialogTitle = isEditing
    ? isSubtask
      ? "Edit Subtask"
      : "Edit Task"
    : isSubtask
      ? "Add Subtask"
      : "Create Task";

  const submitLabel = isEditing
    ? "Save Changes"
    : isSubtask
      ? "Add Subtask"
      : "Create Task";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="task-create-dialog">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} data-testid="task-create-form">
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                data-testid="task-title-input"
              />
            </div>
            {!isSubtask && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-tag">Tag (optional)</Label>
                  <Input
                    id="task-tag"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder="e.g. dev, design, meeting"
                    data-testid="task-tag-input"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="task-jira-key">Jira Key (optional)</Label>
                  <Input
                    id="task-jira-key"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value)}
                    placeholder="e.g. PROJ-123"
                    data-testid="task-jira-input"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim()}
              data-testid="task-create-submit"
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
