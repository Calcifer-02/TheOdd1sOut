import { Task } from '@/types/task';
import { LayoutMode } from '@/types/task';
import { TaskList } from '@/components/tasks/TaskList';
import { TaskGrid } from '@/components/tasks/TaskGrid';
import { TaskCalendar } from '@/components/tasks/TaskCalendar';

interface TasksViewProps {
    tasks: Task[];
    layoutMode: LayoutMode;
    onToggleTask: (taskId: number) => void;
    onReorderTasks?: (tasks: Task[]) => void;
}

export const TasksView = ({ tasks, layoutMode, onToggleTask, onReorderTasks }: TasksViewProps) => {
    switch (layoutMode) {
        case 'list':
            return <TaskList tasks={tasks} onToggleTask={onToggleTask} onReorderTasks={onReorderTasks} />;
        case 'grid':
            return <TaskGrid tasks={tasks} onToggleTask={onToggleTask} />;
        case 'calendar':
            return <TaskCalendar tasks={tasks} onToggleTask={onToggleTask} />;
        default:
            return <TaskList tasks={tasks} onToggleTask={onToggleTask} onReorderTasks={onReorderTasks} />;
    }
};