import { Task } from '@/types/task';
import { CellList } from '@maxhub/max-ui';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { DraggableTaskItem } from './DraggableTaskItem';

interface TaskListProps {
    tasks: Task[];
    onToggleTask: (taskId: number) => void;
    onReorderTasks?: (tasks: Task[]) => void;
}

export const TaskList = ({ tasks, onToggleTask, onReorderTasks }: TaskListProps) => {
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = tasks.findIndex(task => task.id === active.id);
            const newIndex = tasks.findIndex(task => task.id === over.id);

            const newTasks = arrayMove(tasks, oldIndex, newIndex);
            onReorderTasks?.(newTasks);
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={tasks.map(task => task.id)}
                strategy={verticalListSortingStrategy}
            >
                <CellList>
                    {tasks.map(task => (
                        <DraggableTaskItem
                            key={task.id}
                            task={task}
                            onToggleTask={onToggleTask}
                        />
                    ))}
                </CellList>
            </SortableContext>
        </DndContext>
    );
};