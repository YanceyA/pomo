import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTaskStore } from "@/stores/taskStore";
import { DateNavigator } from "./DateNavigator";
import { TaskCreateDialog } from "./TaskCreateDialog";
import { TaskPanel } from "./TaskPanel";
import { TaskPanelOverlay } from "./TaskPanelOverlay";

export function TaskList() {
  const tasks = useTaskStore((s) => s.tasks);
  const isLoading = useTaskStore((s) => s.isLoading);
  const loadTasks = useTaskStore((s) => s.loadTasks);
  const openCreateDialog = useTaskStore((s) => s.openCreateDialog);
  const reorderTasks = useTaskStore((s) => s.reorderTasks);

  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Separate parent tasks and subtasks
  const parentTasks = tasks.filter((t) => t.parent_task_id === null);
  const getSubtasks = (parentId: number) =>
    tasks.filter((t) => t.parent_task_id === parentId);

  const parentIds = parentTasks.map((t) => t.id);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(Number(event.active.id));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = parentIds.indexOf(Number(active.id));
    const newIndex = parentIds.indexOf(Number(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(parentIds, oldIndex, newIndex);
    await reorderTasks(newOrder);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  const activeTask = activeId
    ? parentTasks.find((t) => t.id === activeId)
    : null;

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <div className="flex items-center justify-between">
        <DateNavigator />
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={parentIds}
          strategy={verticalListSortingStrategy}
        >
          {parentTasks.map((task) => (
            <TaskPanel
              key={task.id}
              task={task}
              subtasks={getSubtasks(task.id)}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {activeTask ? (
            <TaskPanelOverlay
              task={activeTask}
              subtasks={getSubtasks(activeTask.id)}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskCreateDialog />
    </div>
  );
}
