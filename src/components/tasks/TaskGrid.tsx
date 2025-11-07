import { Task } from '@/types/task';
import { PRIORITIES } from '@/shared/constants/tasks';
import { Switch, Typography } from '@maxhub/max-ui';
import { User } from 'lucide-react';

interface TaskGridProps {
    tasks: Task[];
    onToggleTask: (taskId: number) => void;
}

export const TaskGrid = ({ tasks, onToggleTask }: TaskGridProps) => {
    const columns = {
        high: tasks.filter(t => t.priority === 'high'),
        medium: tasks.filter(t => t.priority === 'medium'),
        low: tasks.filter(t => t.priority === 'low'),
    };

    return (
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
            {Object.entries(PRIORITIES).map(([key, value]) => (
                <div
                    key={key}
                    style={{
                        flex: '1',
                        minWidth: '280px',
                        background: '#F9FAFB',
                        borderRadius: '12px',
                        padding: '12px',
                    }}
                >
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '12px',
                        paddingBottom: '8px',
                        borderBottom: `2px solid ${value.color}`,
                    }}>
                        <div
                            style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                backgroundColor: value.color,
                            }}
                        />
                        <Typography.Body style={{ fontWeight: 600 }}>
                            {value.label}
                        </Typography.Body>
                        <Typography.Body style={{ color: '#9CA3AF', marginLeft: 'auto' }}>
                            {columns[key as keyof typeof columns].length}
                        </Typography.Body>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {columns[key as keyof typeof columns].map(task => (
                            <div
                                key={task.id}
                                style={{
                                    background: 'white',
                                    borderRadius: '8px',
                                    padding: '12px',
                                    border: '1px solid #E5E7EB',
                                    opacity: task.completed ? 0.6 : 1,
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'start', gap: '8px', marginBottom: '8px' }}>
                                    <Switch
                                        checked={task.completed}
                                        onChange={() => onToggleTask(task.id)}
                                    />
                                    <Typography.Body style={{
                                        flex: 1,
                                        textDecoration: task.completed ? 'line-through' : 'none',
                                    }}>
                                        {task.title}
                                    </Typography.Body>
                                </div>
                                {task.deadline && (
                                    <Typography.Body style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                                        {task.deadline}
                                    </Typography.Body>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {task.tags.map(tag => (
                                            <span
                                                key={tag}
                                                style={{
                                                    fontSize: '11px',
                                                    padding: '2px 6px',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#F3F4F6',
                                                    color: '#6B7280',
                                                }}
                                            >
                        {tag}
                      </span>
                                        ))}
                                    </div>
                                    <User size={14} color="#9CA3AF" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};