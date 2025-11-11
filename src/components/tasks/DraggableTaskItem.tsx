import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types/task';
import { PRIORITIES } from '@/shared/constants/tasks';
import { CellSimple } from '@maxhub/max-ui';
import { User, GripVertical } from 'lucide-react';
import Checkbox from '@/components/ui/Checkbox';

interface DraggableTaskItemProps {
    task: Task;
    onToggleTask: (taskId: number) => void;
    onTaskClick?: (task: Task) => void;
}

export const DraggableTaskItem = ({ task, onToggleTask, onTaskClick }: DraggableTaskItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: task.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'default',
    };

    return (
        <div ref={setNodeRef} style={style}>
            <CellSimple
                onClick={() => onTaskClick?.(task)}
                before={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            {...attributes}
                            {...listeners}
                            style={{
                                cursor: 'grab',
                                display: 'flex',
                                alignItems: 'center',
                                touchAction: 'none',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            <GripVertical size={20} color="#9CA3AF" />
                        </div>
                        <Checkbox
                            checked={task.completed}
                            onChange={() => onToggleTask(task.id)}
                        />
                    </div>
                }
                after={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: PRIORITIES[task.priority].color,
                            }}
                            title={PRIORITIES[task.priority].label}
                        />
                        <User size={16} color="#9CA3AF" />
                    </div>
                }
                subtitle={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {task.deadline && (
                            <span style={{ fontSize: '14px', color: '#6B7280' }}>
                                {typeof task.deadline === 'string'
                                    ? task.deadline
                                    : new Date(task.deadline).toLocaleDateString('ru-RU')}
                            </span>
                        )}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {task.tags.map(tag => (
                                <span
                                    key={tag}
                                    style={{
                                        fontSize: '12px',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        backgroundColor: '#F3F4F6',
                                        color: '#6B7280',
                                    }}
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                }
                style={{
                    textDecoration: task.completed ? 'line-through' : 'none',
                    opacity: task.completed ? 0.6 : 1,
                }}
                innerClassNames={{
                    content: 'task-content-wrapper'
                }}
            >
                <div style={{
                    maxWidth: '100%',
                    wordWrap: 'break-word',
                    overflowWrap: 'break-word',
                    wordBreak: 'break-word',
                    whiteSpace: 'normal',
                }}>
                    {task.title}
                </div>
            </CellSimple>
        </div>
    );
};

