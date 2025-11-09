import React, { useState, useEffect } from 'react';
import { Panel, Button, Typography, Input, Textarea } from '@maxhub/max-ui';
import { X, Edit2, Calendar, Flag, User, Tag as TagIcon } from 'lucide-react';
import { Task } from '@/types/task';
import { PRIORITIES, TAGS } from '@/shared/constants/tasks';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';


interface TaskDetailsModalProps {
    task: Task | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (taskId: number, updates: Partial<Task>) => void;
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
    task,
    isOpen,
    onClose,
    onUpdate,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editedTask, setEditedTask] = useState<Partial<Task>>({});
    const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
    const [showPriorityPicker, setShowPriorityPicker] = useState(false);
    const [showTagsPicker, setShowTagsPicker] = useState(false);

    useEffect(() => {
        if (task) {
            setEditedTask({
                title: task.title,
                description: task.description || '',
                priority: task.priority,
                deadline: task.deadline,
                assignee: task.assignee,
                tags: task.tags || [],
            });
        }
        setIsEditing(false);
    }, [task]);

    if (!isOpen || !task) return null;

    const handleSave = () => {
        if (editedTask.title?.trim()) {
            onUpdate(task.id, editedTask);
            setIsEditing(false);
            onClose();
        }
    };

    const handleCancel = () => {
        setEditedTask({
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            deadline: task.deadline,
            assignee: task.assignee,
            tags: task.tags || [],
        });
        setIsEditing(false);
    };

    const toggleTag = (tag: string) => {
        const currentTags = editedTask.tags || [];
        setEditedTask({
            ...editedTask,
            tags: currentTags.includes(tag)
                ? currentTags.filter(t => t !== tag)
                : [...currentTags, tag]
        });
    };

    const handleDeadlineSelect = (date: Date | undefined) => {
        if (date) {
            setEditedTask({
                ...editedTask,
                deadline: date.toLocaleDateString('ru-RU')
            });
        }
        setShowDeadlinePicker(false);
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-end',
            }}
            onClick={onClose}
        >
            <Panel
                mode="primary"
                style={{
                    width: '100%',
                    maxHeight: '85vh',
                    borderTopLeftRadius: '20px',
                    borderTopRightRadius: '20px',
                    overflow: 'auto',
                    position: 'relative',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    borderBottom: '1px solid var(--vkui--color_separator_primary)',
                }}>
                    <Typography.Headline style={{ fontSize: '20px', fontWeight: 600 }}>
                        {isEditing ? 'Редактирование задачи' : 'Просмотр задачи'}
                    </Typography.Headline>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {!isEditing && (
                            <button
                                onClick={() => setIsEditing(true)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    color: '#007aff',
                                }}
                            >
                                <Edit2 size={20} />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Title */}
                    <div>
                        <Typography.Body style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '12px', marginRight: '12px' }}>
                            Название
                        </Typography.Body>
                        {isEditing ? (
                            <Input
                                mode="secondary"
                                placeholder="Название задачи"
                                value={editedTask.title || ''}
                                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                            />
                        ) : (
                            <Typography.Body style={{ fontSize: '16px', lineHeight: '1.5' }}>
                                {task.title}
                            </Typography.Body>
                        )}
                    </div>

                    {/* Description */}
                    <div>
                        <Typography.Body style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '12px', marginRight: '12px' }}>
                            Описание
                        </Typography.Body>
                        {isEditing ? (
                            <Textarea
                                mode="secondary"
                                placeholder="Добавьте описание"
                                value={editedTask.description || ''}
                                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                                rows={4}
                            />
                        ) : (
                            <Typography.Body style={{ fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {task.description || 'Нет описания'}
                            </Typography.Body>
                        )}
                    </div>

                    {/* Priority */}
                    <div>
                        <Typography.Body style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '20px' }}>
                            Приоритет
                        </Typography.Body>
                        {isEditing ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowPriorityPicker(!showPriorityPicker)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'var(--vkui--color_background_secondary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <Flag size={16} color={PRIORITIES[editedTask.priority || 'medium'].color} />
                                    <span>{PRIORITIES[editedTask.priority || 'medium'].label}</span>
                                </button>
                                {showPriorityPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: '8px',
                                        background: '#FFFFFF',
                                        borderRadius: '12px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                        zIndex: 10000,
                                        overflow: 'hidden',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                    }}>
                                        {Object.entries(PRIORITIES).map(([key, { label, color }]) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    setEditedTask({ ...editedTask, priority: key as 'low' | 'medium' | 'high' });
                                                    setShowPriorityPicker(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                }}
                                            >
                                                <Flag size={16} color={color} />
                                                <span>{label}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Flag size={16} color={PRIORITIES[task.priority].color} />
                                <Typography.Body>{PRIORITIES[task.priority].label}</Typography.Body>
                            </div>
                        )}
                    </div>

                    {/* Deadline */}
                    <div>
                        <Typography.Body style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '12px' }}>
                            Срок
                        </Typography.Body>
                        {isEditing ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowDeadlinePicker(!showDeadlinePicker)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'var(--vkui--color_background_secondary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                    }}
                                >
                                    <Calendar size={16} />
                                    <span>
                                        {editedTask.deadline
                                            ? (typeof editedTask.deadline === 'string'
                                                ? editedTask.deadline
                                                : editedTask.deadline.toLocaleDateString('ru-RU'))
                                            : 'Без срока'}
                                    </span>
                                </button>
                                {showDeadlinePicker && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        marginTop: '8px',
                                        background: '#FFFFFF',
                                        borderRadius: '16px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                        zIndex: 10000,
                                        padding: '16px',
                                        maxWidth: '90vw',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                    }}>
                                        <style>{`
                                            .rdp {
                                                --rdp-accent-color: #007aff;
                                                --rdp-accent-background-color: #007aff;
                                            }
                                            .rdp-root {
                                                font-size: 14px;
                                            }
                                            .rdp-selected .rdp-day_button {
                                                background-color: #007aff !important;
                                                color: white !important;
                                            }
                                        `}</style>
                                        <DayPicker
                                            mode="single"
                                            selected={editedTask.deadline ? new Date(editedTask.deadline) : undefined}
                                            onSelect={handleDeadlineSelect}
                                            locale={undefined}
                                        />
                                        <Button
                                            appearance="neutral"
                                            mode="tertiary"
                                            size="medium"
                                            stretched
                                            onClick={() => {
                                                setEditedTask({ ...editedTask, deadline: undefined });
                                                setShowDeadlinePicker(false);
                                            }}
                                            style={{ marginTop: '8px' }}
                                        >
                                            Без срока
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={16} />
                                <Typography.Body>
                                    {task.deadline
                                        ? (typeof task.deadline === 'string'
                                            ? task.deadline
                                            : task.deadline.toLocaleDateString('ru-RU'))
                                        : 'Без срока'}
                                </Typography.Body>
                            </div>
                        )}
                    </div>

                    {/* Assignee */}
                    <div>
                        <Typography.Body style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '12px' }}>
                            Исполнитель
                        </Typography.Body>
                        {isEditing ? (
                            <Input
                                mode="secondary"
                                placeholder="Исполнитель"
                                value={editedTask.assignee || ''}
                                onChange={(e) => setEditedTask({ ...editedTask, assignee: e.target.value })}
                            />
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <User size={16} />
                                <Typography.Body style={{ fontSize: '16px' }}>{task.assignee}</Typography.Body>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <Typography.Body style={{ fontSize: '14px', color: '#8E8E93', marginBottom: '12px' }}>
                            Метки
                        </Typography.Body>
                        {isEditing ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowTagsPicker(!showTagsPicker)}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        background: 'var(--vkui--color_background_secondary)',
                                        border: 'none',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <TagIcon size={16} />
                                    {editedTask.tags && editedTask.tags.length > 0 ? (
                                        editedTask.tags.map(tag => (
                                            <span key={tag} style={{
                                                padding: '4px 8px',
                                                background: '#007aff',
                                                color: 'white',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                            }}>
                                                {tag}
                                            </span>
                                        ))
                                    ) : (
                                        <span>Выберите метки</span>
                                    )}
                                </button>
                                {showTagsPicker && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: '8px',
                                        background: '#FFFFFF',
                                        borderRadius: '12px',
                                        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                                        zIndex: 10000,
                                        padding: '12px',
                                        border: '1px solid rgba(0,0,0,0.1)',
                                    }}>
                                        {TAGS.map(tag => (
                                            <label
                                                key={tag}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    padding: '8px',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={editedTask.tags?.includes(tag)}
                                                    onChange={() => toggleTag(tag)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                                <span>{tag}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {task.tags && task.tags.length > 0 ? (
                                    task.tags.map(tag => (
                                        <span key={tag} style={{
                                            padding: '4px 8px',
                                            background: '#007aff',
                                            color: 'white',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                        }}>
                                            {tag}
                                        </span>
                                    ))
                                ) : (
                                    <Typography.Body>Нет меток</Typography.Body>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                {isEditing && (
                    <div style={{
                        padding: '16px',
                        borderTop: '1px solid var(--vkui--color_separator_primary)',
                        display: 'flex',
                        gap: '8px',
                    }}>
                        <Button
                            appearance="neutral"
                            mode="secondary"
                            size="large"
                            stretched
                            onClick={handleCancel}
                        >
                            Отмена
                        </Button>
                        <Button
                            appearance="themed"
                            mode="primary"
                            size="large"
                            stretched
                            onClick={handleSave}
                        >
                            Сохранить
                        </Button>
                    </div>
                )}
            </Panel>
        </div>
    );
};

