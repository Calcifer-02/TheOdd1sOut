import { useState } from 'react';
import { Task, NewTaskFormData } from '@/types/task';
import { Panel, Typography, IconButton, Input, Textarea, CellList, CellSimple, Button, Flex } from '@maxhub/max-ui';
import { X, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ASSIGNEES, PRIORITIES, TAGS, REMINDER_OPTIONS } from '@/shared/constants/tasks';
import { PriorityPicker } from './PriorityPicker';
import { DeadlinePicker } from './DeadlinePicker';
import { ReminderPicker } from './ReminderPicker';
import { TagsPicker } from './TagsPicker';
import { AssigneePicker } from './AssigneePicker';

interface NewTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateTask: (task: Omit<Task, 'id'>) => void;
}

export const NewTaskModal = ({ isOpen, onClose, onCreateTask }: NewTaskModalProps) => {
    const [formData, setFormData] = useState<NewTaskFormData>({
        title: '',
        description: '',
        priority: 'medium',
        deadline: undefined,
        time: '',
        assignee: 'Я',
        tags: [],
        reminder: '',
    });

    const [showPriorityPicker, setShowPriorityPicker] = useState(false);
    const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
    const [showReminderPicker, setShowReminderPicker] = useState(false);
    const [showTagsPicker, setShowTagsPicker] = useState(false);
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            priority: 'medium',
            deadline: undefined,
            time: '',
            assignee: 'Я',
            tags: [],
            reminder: '',
        });
    };

    const handleCreateTask = () => {
        if (!formData.title.trim()) {
            alert('Введите название задачи');
            return;
        }

        const newTask: Omit<Task, 'id'> = {
            title: formData.title,
            completed: false,
            deadline: formData.deadline
                ? `${formData.deadline.toLocaleDateString('ru-RU')}${formData.time ? `, ${formData.time}` : ''}`
                : undefined,
            priority: formData.priority,
            assignee: formData.assignee,
            tags: formData.tags,
        };

        onCreateTask(newTask);
        resetForm();
        onClose();
    };

    const toggleTag = (tag: string) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags.includes(tag)
                ? prev.tags.filter(t => t !== tag)
                : [...prev.tags, tag]
        }));
    };

    if (!isOpen) return null;

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
            onClick={() => {
                resetForm();
                onClose();
            }}
        >
            <Panel
                mode="primary"
                style={{
                    width: '100%',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{
                    padding: '16px',
                    borderBottom: '1px solid #E5E7EB',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <Typography.Headline>Новая задача</Typography.Headline>
                    <IconButton onClick={() => {
                        resetForm();
                        onClose();
                    }}>
                        <X size={24} />
                    </IconButton>
                </div>

                <div style={{ padding: '16px' }}>
                    <Input
                        mode="primary"
                        placeholder="Название задачи"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        style={{ width: '100%', marginBottom: '16px' }}
                    />

                    <Textarea
                        mode="primary"
                        placeholder="Описание (необязательно)"
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        style={{ width: '100%', marginBottom: '16px' }}
                    />

                    <CellList style={{ marginBottom: '16px' }}>
                        <CellSimple
                            onClick={() => setShowPriorityPicker(true)}
                            before={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div
                                        style={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: PRIORITIES[formData.priority].color,
                                        }}
                                    />
                                    <span>Приоритет</span>
                                </div>
                            }
                            after={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Typography.Body style={{ color: '#6B7280' }}>
                                        {PRIORITIES[formData.priority].label}
                                    </Typography.Body>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </div>
                            }
                        />

                        <CellSimple
                            onClick={() => setShowDeadlinePicker(true)}
                            before={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={20} color="#6B7280" />
                                    <span>Дедлайн</span>
                                </div>
                            }
                            after={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Typography.Body style={{ color: '#6B7280' }}>
                                        {formData.deadline
                                            ? `${formData.deadline.toLocaleDateString('ru-RU')}${formData.time ? `, ${formData.time}` : ''}`
                                            : 'Без срока'}
                                    </Typography.Body>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </div>
                            }
                        />

                        <CellSimple
                            onClick={() => setShowReminderPicker(true)}
                            before={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Bell size={20} color="#6B7280" />
                                    <span>Напоминание</span>
                                </div>
                            }
                            after={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Typography.Body style={{ color: '#6B7280' }}>
                                        {formData.reminder || 'Не установлено'}
                                    </Typography.Body>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </div>
                            }
                        />

                        <CellSimple
                            onClick={() => setShowTagsPicker(true)}
                            before={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Tag size={20} color="#6B7280" />
                                    <span>Метки</span>
                                </div>
                            }
                            after={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Typography.Body style={{ color: '#6B7280' }}>
                                        {formData.tags.length > 0 ? formData.tags.join(', ') : 'Не выбраны'}
                                    </Typography.Body>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </div>
                            }
                        />

                        <CellSimple
                            onClick={() => setShowAssigneePicker(true)}
                            before={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <User size={20} color="#6B7280" />
                                    <span>Исполнитель</span>
                                </div>
                            }
                            after={
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Typography.Body style={{ color: '#6B7280' }}>
                                        {formData.assignee}
                                    </Typography.Body>
                                    <ChevronRight size={20} color="#9CA3AF" />
                                </div>
                            }
                        />
                    </CellList>

                    <Flex direction="column" gap={12}>
                        <Button
                            appearance="themed"
                            mode="primary"
                            size="large"
                            stretched
                            onClick={handleCreateTask}
                        >
                            Создать задачу
                        </Button>
                        <Button
                            appearance="neutral"
                            mode="secondary"
                            size="large"
                            stretched
                            onClick={() => {
                                resetForm();
                                onClose();
                            }}
                        >
                            Отмена
                        </Button>
                    </Flex>
                </div>
            </Panel>

            {/* Пикеры */}
            <PriorityPicker
                isOpen={showPriorityPicker}
                onClose={() => setShowPriorityPicker(false)}
                selectedPriority={formData.priority}
                onSelect={(priority) => setFormData(prev => ({ ...prev, priority }))}
            />

            <DeadlinePicker
                isOpen={showDeadlinePicker}
                onClose={() => setShowDeadlinePicker(false)}
                selectedDate={formData.deadline}
                selectedTime={formData.time}
                onDateChange={(date) => setFormData(prev => ({ ...prev, deadline: date }))}
                onTimeChange={(time) => setFormData(prev => ({ ...prev, time }))}
            />

            <ReminderPicker
                isOpen={showReminderPicker}
                onClose={() => setShowReminderPicker(false)}
                selectedReminder={formData.reminder}
                onSelect={(reminder) => setFormData(prev => ({ ...prev, reminder }))}
            />

            <TagsPicker
                isOpen={showTagsPicker}
                onClose={() => setShowTagsPicker(false)}
                selectedTags={formData.tags}
                onToggleTag={toggleTag}
            />

            <AssigneePicker
                isOpen={showAssigneePicker}
                onClose={() => setShowAssigneePicker(false)}
                selectedAssignee={formData.assignee}
                onSelect={(assignee) => setFormData(prev => ({ ...prev, assignee }))}
            />
        </div>
    );
};

// Импортируем недостающие иконки
import { Clock, Bell, Tag, User } from 'lucide-react';