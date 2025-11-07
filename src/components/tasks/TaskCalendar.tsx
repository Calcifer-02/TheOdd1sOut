import { Task } from '@/types/task';
import { CellList, CellSimple, Switch } from '@maxhub/max-ui';
import { Typography } from '@maxhub/max-ui';
import { PRIORITIES } from '@/shared/constants/tasks';

interface TaskCalendarProps {
    tasks: Task[];
    onToggleTask: (taskId: number) => void;
}

export const TaskCalendar = ({ tasks, onToggleTask }: TaskCalendarProps) => {
    const today = tasks.filter(t => t.deadline?.includes('Сегодня'));
    const tomorrow = tasks.filter(t => t.deadline?.includes('Завтра'));
    const overdue = tasks.filter(t => t.deadline?.includes('Вчера'));
    const noDeadline = tasks.filter(t => !t.deadline);

    const sections = [
        { title: 'Просрочено', tasks: overdue, color: '#EF4444' },
        { title: 'Сегодня', tasks: today, color: '#3B82F6' },
        { title: 'Завтра', tasks: tomorrow, color: '#10B981' },
        { title: 'Без срока', tasks: noDeadline, color: '#9CA3AF' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sections.map(section => (
                section.tasks.length > 0 && (
                    <div key={section.title}>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                        }}>
                            <div
                                style={{
                                    width: '4px',
                                    height: '20px',
                                    borderRadius: '2px',
                                    backgroundColor: section.color,
                                }}
                            />
                            <Typography.Body style={{ fontWeight: 600, fontSize: '16px' }}>
                                {section.title}
                            </Typography.Body>
                            <Typography.Body style={{ color: '#9CA3AF' }}>
                                {section.tasks.length}
                            </Typography.Body>
                        </div>
                        <CellList>
                            {section.tasks.map(task => (
                                <CellSimple
                                    key={task.id}
                                    before={
                                        <Switch
                                            checked={task.completed}
                                            onChange={() => onToggleTask(task.id)}
                                        />
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
                                        </div>
                                    }
                                    subtitle={
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {task.deadline && (
                                                <span style={{ fontSize: '14px', color: '#6B7280' }}>
                          {task.deadline}
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
                                >
                                    {task.title}
                                </CellSimple>
                            ))}
                        </CellList>
                    </div>
                )
            ))}
        </div>
    );
};