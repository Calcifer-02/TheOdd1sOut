import { useState, useEffect } from 'react';
import { Task, NewTaskFormData } from '@/types/task';
import { Panel, Typography, IconButton, Input, Textarea, CellList, CellSimple, Button, Flex } from '@maxhub/max-ui';
import { X, ChevronRight, Clock, Tag, User } from 'lucide-react';
import { PRIORITIES } from '@/shared/constants/tasks';
import { PriorityPicker } from './PriorityPicker';
import { DeadlinePicker } from './DeadlinePicker';
import { TagsPicker } from './TagsPicker';
import { AssigneePicker } from './AssigneePicker';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { VoiceInputButton } from '@/components/ui/VoiceInputButton';
import { aiTaskParser } from '@/services/aiTaskParser';
import { useAppSelector } from '@/store/hooks';

interface NewTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateTask: (task: Omit<Task, 'id'>) => Promise<Task | null>;
}

export const NewTaskModal = ({ isOpen, onClose, onCreateTask }: NewTaskModalProps) => {
    // Получаем настройки из Redux
    const taskSettings = useAppSelector((state) => state.settings.taskSettings);

    const [formData, setFormData] = useState<NewTaskFormData>({
        title: '',
        description: '',
        priority: taskSettings.defaultPriority, // Используем приоритет из настроек
        deadline: undefined,
        time: '',
        assignee: 'Я',
        tags: [],
    });

    const [showPriorityPicker, setShowPriorityPicker] = useState(false);
    const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
    const [showTagsPicker, setShowTagsPicker] = useState(false);
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);
    const [voiceError, setVoiceError] = useState<string | null>(null);
    const [isAIProcessing, setIsAIProcessing] = useState(false);
    const [useAI, setUseAI] = useState(true); // Флаг использования AI парсинга

    // Голосовой ввод
    const {
        transcript,
        isListening,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    } = useSpeechRecognition({
        onResult: async (text) => {
            if (useAI) {
                // AI парсинг через backend
                setIsAIProcessing(true);
                try {
                    const parsed = await aiTaskParser.parseTaskFromSpeech(text);

                    // Заполняем все поля из AI
                    setFormData(prev => ({
                        ...prev,
                        title: parsed.title,
                        description: parsed.description || prev.description,
                        priority: parsed.priority,
                        deadline: parsed.deadline ? parseDateString(parsed.deadline) : prev.deadline,
                        time: parsed.time || prev.time,
                        assignee: parsed.assignee || prev.assignee,
                        tags: parsed.tags || prev.tags,
                    }));
                } catch (error) {
                    console.error('AI parsing failed:', error);
                    // Фолбэк на простое заполнение title
                    setFormData(prev => ({
                        ...prev,
                        title: text,
                    }));
                } finally {
                    setIsAIProcessing(false);
                }
            } else {
                // Простое заполнение без AI
                setFormData(prev => ({
                    ...prev,
                    title: text,
                }));
            }
        },
        onError: (error) => {
            setVoiceError(error);
            setTimeout(() => setVoiceError(null), 3000);
        },
        lang: 'ru-RU',
    });

    // Обновляем title когда меняется transcript
    useEffect(() => {
        if (transcript && isListening) {
            setFormData(prev => ({
                ...prev,
                title: transcript,
            }));
        }
    }, [transcript, isListening]);

    const handleVoiceStart = async () => {
        setVoiceError(null);
        await startListening();
    };

    const handleVoiceStop = () => {
        stopListening();
    };

    // Парсинг строки даты в Date объект
    const parseDateString = (dateStr: string): Date | undefined => {
        try {
            // Формат DD.MM.YYYY
            const parts = dateStr.split('.');
            if (parts.length === 3) {
                const day = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1; // месяцы с 0
                const year = parseInt(parts[2]);
                return new Date(year, month, day);
            }
            return undefined;
        } catch {
            return undefined;
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            priority: taskSettings.defaultPriority, // Используем приоритет из настроек
            deadline: undefined,
            time: '',
            assignee: 'Я',
            tags: [],
        });
        resetTranscript();
    };

    const handleCreateTask = async () => {
        if (!formData.title.trim()) {
            alert('Введите название задачи');
            return;
        }

        const newTask: Omit<Task, 'id'> = {
            title: formData.title.trim(),
            description: formData.description?.trim() || '',
            completed: false,
            deadline: formData.deadline
                ? `${formData.deadline.toLocaleDateString('ru-RU')}${formData.time ? `, ${formData.time}` : ''}`
                : undefined,
            priority: formData.priority,
            assignee: formData.assignee,
            tags: formData.tags,
        };

        console.log('Creating task:', newTask);


        await onCreateTask(newTask);

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
                    {/* Уведомление об ошибке голосового ввода */}
                    {voiceError && (
                        <div style={{
                            padding: '12px',
                            marginBottom: '16px',
                            background: '#FEE2E2',
                            color: '#991B1B',
                            borderRadius: '8px',
                            fontSize: '14px',
                        }}>
                            {voiceError}
                        </div>
                    )}

                    {/* Уведомление о прослушивании */}
                    {isListening && (
                        <div style={{
                            padding: '12px',
                            marginBottom: '16px',
                            background: '#DBEAFE',
                            color: '#1E40AF',
                            borderRadius: '8px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#EF4444',
                                animation: 'blink 1s ease-in-out infinite',
                            }} />
                            <style>{`
                                @keyframes blink {
                                    0%, 100% { opacity: 1; }
                                    50% { opacity: 0.3; }
                                }
                            `}</style>
                            Слушаю... Говорите название задачи
                        </div>
                    )}

                    {/* Уведомление об AI обработке */}
                    {isAIProcessing && (
                        <div style={{
                            padding: '12px',
                            marginBottom: '16px',
                            background: '#F3E8FF',
                            color: '#6B21A8',
                            borderRadius: '8px',
                            fontSize: '14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}>
                            <div style={{
                                width: '16px',
                                height: '16px',
                                border: '2px solid #6B21A8',
                                borderTopColor: 'transparent',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                            }} />
                            <style>{`
                                @keyframes spin {
                                    to { transform: rotate(360deg); }
                                }
                            `}</style>
                            AI анализирует задачу и заполняет поля...
                        </div>
                    )}

                    {/* Название задачи с кнопкой микрофона */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <Input
                            mode="primary"
                            placeholder="Название задачи"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            style={{ flex: 1 }}
                        />
                        {isSupported && (
                            <VoiceInputButton
                                isListening={isListening}
                                isSupported={isSupported}
                                onStart={handleVoiceStart}
                                onStop={handleVoiceStop}
                            />
                        )}
                    </div>

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
