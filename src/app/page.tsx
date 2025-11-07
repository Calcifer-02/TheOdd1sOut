'use client';

import { useState, useEffect, useMemo } from 'react';
import ClientLayout from '@/components/layout/ClientLayout';
import {
  Typography,
  Panel,
  CellList,
  CellSimple,
  Switch,
  Button,
  IconButton,
  Container,
  Input,
  Flex,
  Textarea,
} from '@maxhub/max-ui';
import {
  Filter,
  Plus,
  List,
  Grid3x3,
  Calendar,
  User,
  CheckCircle2,
  Sparkles,
  Brain,
  Share2,
  Clock,
  Bell,
  Tag,
  ChevronRight,
  X,
} from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import 'react-day-picker/dist/style.css';

// Типы
interface Task {
  id: number;
  title: string;
  completed: boolean;
  deadline?: string;
  priority: 'low' | 'medium' | 'high';
  assignee: string;
  tags: string[];
}

interface Assignee {
  id: number;
  name: string;
}

type LayoutMode = 'list' | 'grid' | 'calendar';
type SortBy = 'deadline' | 'priority' | 'name';

// Моковые данные
const ASSIGNEES: Assignee[] = [
  { id: 1, name: 'Я' },
  { id: 2, name: 'Александр' },
  { id: 3, name: 'Команда' },
];

const PRIORITIES = {
  low: { label: 'Низкий', color: '#9CA3AF' },
  medium: { label: 'Средний', color: '#F59E0B' },
  high: { label: 'Высокий', color: '#EF4444' },
};

const TAGS = ['личное', 'работа', 'срочно'];

const MOCK_TASKS: Task[] = [
  {
    id: 1,
    title: 'Подготовить презентацию для встречи',
    completed: false,
    deadline: 'Сегодня, 14:00',
    priority: 'high',
    assignee: 'Я',
    tags: ['работа', 'срочно'],
  },
  {
    id: 2,
    title: 'Купить продукты',
    completed: false,
    deadline: 'Сегодня, 18:00',
    priority: 'low',
    assignee: 'Я',
    tags: ['личное'],
  },
  {
    id: 3,
    title: 'Код-ревью pull request',
    completed: true,
    deadline: 'Вчера, 17:00',
    priority: 'medium',
    assignee: 'Александр',
    tags: ['работа'],
  },
  {
    id: 4,
    title: 'Позвонить клиенту',
    completed: false,
    deadline: 'Завтра, 10:00',
    priority: 'medium',
    assignee: 'Команда',
    tags: ['работа'],
  },
  {
    id: 5,
    title: 'Обновить документацию',
    completed: false,
    priority: 'low',
    assignee: 'Я',
    tags: ['работа'],
  },
];

// Отключаем статическую генерацию
export const dynamic = 'force-dynamic';

export default function HomePage() {
  // Состояние
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  // Фильтры и настройки
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('list');
  const [sortBy, setSortBy] = useState<SortBy>('deadline');
  const [selectedAssignees, setSelectedAssignees] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Форма новой задачи
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newTaskDeadline, setNewTaskDeadline] = useState<Date | undefined>(undefined);
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('Я');
  const [newTaskTags, setNewTaskTags] = useState<string[]>([]);
  const [newTaskReminder, setNewTaskReminder] = useState<string>('');

  // Модальные окна для выбора
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showDeadlinePicker, setShowDeadlinePicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showTagsPicker, setShowTagsPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // Имитация загрузки данных
  useEffect(() => {
    const loadTasks = async () => {
      // Имитация задержки загрузки
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTasks(MOCK_TASKS);
      setIsLoading(false);
    };

    loadTasks();
  }, []);

  // Форматирование даты (безопасно для SSR)
  const formattedDate = useMemo(() => {
    if (typeof window === 'undefined') return '';

    const today = new Date();
    const dateString = today.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      weekday: 'long',
    });
    const [day, month, weekday] = dateString.split(' ');
    return `${day} ${month}, ${weekday}`;
  }, []);

  // Обработчики
  const toggleTask = (taskId: number) => {
    setTasks(tasks.map(task =>
      task.id === taskId ? { ...task, completed: !task.completed } : task
    ));
  };

  const toggleAssignee = (assignee: string) => {
    setSelectedAssignees(prev =>
      prev.includes(assignee)
        ? prev.filter(a => a !== assignee)
        : [...prev, assignee]
    );
  };

  const togglePriority = (priority: string) => {
    setSelectedPriorities(prev =>
      prev.includes(priority)
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Функция для шаринга
  const handleShare = async () => {
    // Проверка на клиентскую сторону
    if (typeof window === 'undefined') return;

    const completedCount = filteredTasks.filter(t => t.completed).length;
    const totalCount = filteredTasks.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    // Формируем текст для шаринга
    const shareText = `📋 Мой прогресс на ${formattedDate}

✅ Выполнено: ${completedCount} из ${totalCount} задач (${completionRate}%)

${filteredTasks.slice(0, 3).map((task, index) => 
  `${index + 1}. ${task.completed ? '✅' : '⬜'} ${task.title}`
).join('\n')}${filteredTasks.length > 3 ? `\n...и ещё ${filteredTasks.length - 3}` : ''}

#продуктивность #задачи`;

    // Формируем URL (в реальном приложении это будет динамический URL)
    const shareUrl = `${window.location.origin}${window.location.pathname}`;

    // Проверяем поддержку Web Share API
    if (navigator && navigator.share) {
      try {
        await navigator.share({
          title: `Мой прогресс на ${formattedDate}`,
          text: shareText,
          url: shareUrl,
        });
      } catch (error) {
        // Пользователь отменил шаринг или произошла ошибка
        if ((error as Error).name !== 'AbortError') {
          console.error('Ошибка при шаринге:', error);
          // Фолбэк: копируем в буфер обмена
          fallbackCopyToClipboard(shareText, shareUrl);
        }
      }
    } else {
      // Фолбэк для браузеров без поддержки Web Share API
      fallbackCopyToClipboard(shareText, shareUrl);
    }
  };

  // Фолбэк функция для копирования в буфер обмена
  const fallbackCopyToClipboard = async (text: string, url: string) => {
    if (typeof window === 'undefined') return;

    try {
      if (navigator && navigator.clipboard) {
        await navigator.clipboard.writeText(`${text}\n\n${url}`);
        alert('Ссылка скопирована в буфер обмена!');
      }
    } catch (error) {
      console.error('Ошибка копирования:', error);
      alert('Не удалось скопировать ссылку');
    }
  };

  // Функции для формы новой задачи
  const resetNewTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskPriority('medium');
    setNewTaskDeadline(undefined);
    setNewTaskTime('');
    setNewTaskAssignee('Я');
    setNewTaskTags([]);
    setNewTaskReminder('');
    setShowPriorityPicker(false);
    setShowDeadlinePicker(false);
    setShowReminderPicker(false);
    setShowTagsPicker(false);
    setShowAssigneePicker(false);
  };

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      alert('Введите название задачи');
      return;
    }

    const newTask: Task = {
      id: Math.max(...tasks.map(t => t.id), 0) + 1,
      title: newTaskTitle,
      completed: false,
      deadline: newTaskDeadline
        ? `${format(newTaskDeadline, 'd MMMM', { locale: ru })}${newTaskTime ? `, ${newTaskTime}` : ''}`
        : undefined,
      priority: newTaskPriority,
      assignee: newTaskAssignee,
      tags: newTaskTags,
    };

    setTasks([...tasks, newTask]);
    resetNewTaskForm();
    setIsNewTaskModalOpen(false);
  };

  const toggleNewTaskTag = (tag: string) => {
    setNewTaskTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Фильтрация задач
  const filteredTasks = tasks.filter(task => {
    if (selectedAssignees.length > 0 && !selectedAssignees.includes(task.assignee)) {
      return false;
    }
    if (selectedPriorities.length > 0 && !selectedPriorities.includes(task.priority)) {
      return false;
    }
    if (selectedTags.length > 0 && !task.tags.some(tag => selectedTags.includes(tag))) {
      return false;
    }
    return true;
  });

  // Skeleton компонент для загрузки
  const renderSkeleton = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            background: '#F9FAFB',
            borderRadius: '12px',
            padding: '16px',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '40px',
                height: '24px',
                background: '#E5E7EB',
                borderRadius: '12px',
              }}
            />
            <div
              style={{
                flex: 1,
                height: '20px',
                background: '#E5E7EB',
                borderRadius: '8px',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px', marginLeft: '52px' }}>
            <div
              style={{
                width: '80px',
                height: '16px',
                background: '#E5E7EB',
                borderRadius: '6px',
              }}
            />
            <div
              style={{
                width: '60px',
                height: '16px',
                background: '#E5E7EB',
                borderRadius: '6px',
              }}
            />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );

  // Пустое состояние
  const renderEmptyState = () => (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '160px',
          height: '160px',
          marginBottom: '24px',
        }}
      >
        {/* Фоновый круг с градиентом */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '140px',
            height: '140px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
            opacity: 0.6,
          }}
        />

        {/* Центральная иконка */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <CheckCircle2 size={64} color="#3B82F6" strokeWidth={1.5} />
        </div>

        {/* Декоративные элементы */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            animation: 'float 3s ease-in-out infinite',
          }}
        >
          <Sparkles size={24} color="#F59E0B" />
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            animation: 'float 3s ease-in-out infinite 1s',
          }}
        >
          <Brain size={28} color="#8B5CF6" />
        </div>
      </div>

      <Typography.Headline style={{ marginBottom: '8px', color: '#1F2937' }}>
        Всё сделано!
      </Typography.Headline>

      <Typography.Body style={{ marginBottom: '24px', color: '#6B7280', maxWidth: '280px' }}>
        {filteredTasks.length === 0 && tasks.length > 0
          ? 'Нет задач по выбранным фильтрам'
          : 'У вас пока нет задач. Создайте свою первую задачу и начните путь к продуктивности!'}
      </Typography.Body>

      <Button
        appearance="themed"
        mode="primary"
        size="medium"
        onClick={() => setIsNewTaskModalOpen(true)}
        iconBefore={<Plus size={20} />}
      >
        Создать задачу
      </Button>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
      `}</style>
    </div>
  );

  // Рендер списка задач
  const renderListView = () => (
    <CellList>
      {filteredTasks.map(task => (
        <CellSimple
          key={task.id}
          before={
            <Switch
              checked={task.completed}
              onChange={() => toggleTask(task.id)}
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
              <User size={16} color="#9CA3AF" />
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
  );

  // Рендер доски (канбан)
  const renderGridView = () => {
    const columns = {
      high: filteredTasks.filter(t => t.priority === 'high'),
      medium: filteredTasks.filter(t => t.priority === 'medium'),
      low: filteredTasks.filter(t => t.priority === 'low'),
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
                      onChange={() => toggleTask(task.id)}
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

  // Рендер календаря
  const renderCalendarView = () => {
    const today = filteredTasks.filter(t => t.deadline?.includes('Сегодня'));
    const tomorrow = filteredTasks.filter(t => t.deadline?.includes('Завтра'));
    const overdue = filteredTasks.filter(t => t.deadline?.includes('Вчера'));
    const noDeadline = filteredTasks.filter(t => !t.deadline);

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
                        onChange={() => toggleTask(task.id)}
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

  return (
    <ClientLayout>
      <Container>
        <div style={{ padding: '16px', paddingBottom: '80px' }}>
          {/* Заголовок с кнопками фильтра и шаринга */}
          <Flex
            direction="row"
            gap={12}
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <Typography.Headline>Сегодня</Typography.Headline>
            <Flex direction="row" gap={8}>
              <IconButton onClick={handleShare}>
                <Share2 size={24} />
              </IconButton>
              <IconButton onClick={() => setIsFilterPanelOpen(true)}>
                <Filter size={24} />
              </IconButton>
            </Flex>
          </Flex>

          {/* Дата */}
          <Typography.Body style={{ marginBottom: '24px', color: '#6B7280' }}>
            {formattedDate}
          </Typography.Body>

          {/* Отображение в зависимости от состояния */}
          {isLoading ? (
            renderSkeleton()
          ) : filteredTasks.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {layoutMode === 'list' && renderListView()}
              {layoutMode === 'grid' && renderGridView()}
              {layoutMode === 'calendar' && renderCalendarView()}
            </>
          )}
        </div>
      </Container>

      {/* FAB - кнопка добавления задачи */}
      <Button
        appearance="themed"
        mode="primary"
        size="medium"
        onClick={() => setIsNewTaskModalOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          padding: 0,
          minWidth: 'unset',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
        }}
      >
        <Plus size={24} />
      </Button>

      {/* Панель фильтров */}
      {isFilterPanelOpen && (
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
          onClick={() => setIsFilterPanelOpen(false)}
        >
          <Panel
            mode="primary"
            style={{
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
              <Typography.Headline>Настройки</Typography.Headline>
            </div>
        <div style={{ padding: '16px' }}>
          {/* Выбор раскладки */}
          <div style={{ marginBottom: '24px' }}>
            <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
              Раскладка
            </Typography.Body>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
              <button
                onClick={() => setLayoutMode('list')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: layoutMode === 'list' ? '16px 12px' : '16px 12px',
                  border: '2px solid',
                  borderColor: layoutMode === 'list' ? '#3B82F6' : '#E5E7EB',
                  borderRadius: '12px',
                  background: layoutMode === 'list' ? '#EFF6FF' : '#F9FAFB',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <List size={32} color={layoutMode === 'list' ? '#3B82F6' : '#6B7280'} />
                <Typography.Body style={{ fontSize: '12px', color: layoutMode === 'list' ? '#3B82F6' : '#6B7280' }}>
                  Список
                </Typography.Body>
              </button>
              <button
                onClick={() => setLayoutMode('grid')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 12px',
                  border: '2px solid',
                  borderColor: layoutMode === 'grid' ? '#3B82F6' : '#E5E7EB',
                  borderRadius: '12px',
                  background: layoutMode === 'grid' ? '#EFF6FF' : '#F9FAFB',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Grid3x3 size={32} color={layoutMode === 'grid' ? '#3B82F6' : '#6B7280'} />
                <Typography.Body style={{ fontSize: '12px', color: layoutMode === 'grid' ? '#3B82F6' : '#6B7280' }}>
                  Доска
                </Typography.Body>
              </button>
              <button
                onClick={() => setLayoutMode('calendar')}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '16px 12px',
                  border: '2px solid',
                  borderColor: layoutMode === 'calendar' ? '#3B82F6' : '#E5E7EB',
                  borderRadius: '12px',
                  background: layoutMode === 'calendar' ? '#EFF6FF' : '#F9FAFB',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Calendar size={32} color={layoutMode === 'calendar' ? '#3B82F6' : '#6B7280'} />
                <Typography.Body style={{ fontSize: '12px', color: layoutMode === 'calendar' ? '#3B82F6' : '#6B7280' }}>
                  Календарь
                </Typography.Body>
              </button>
            </div>
          </div>

          {/* Сортировка */}
          <div style={{ marginBottom: '24px' }}>
            <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
              Сортировка
            </Typography.Body>
            <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
              <CellSimple
                before={
                  <Switch
                    checked={sortBy === 'deadline'}
                    onChange={() => setSortBy('deadline')}
                  />
                }
              >
                По дедлайну
              </CellSimple>
              <CellSimple
                before={
                  <Switch
                    checked={sortBy === 'priority'}
                    onChange={() => setSortBy('priority')}
                  />
                }
              >
                По приоритету
              </CellSimple>
              <CellSimple
                before={
                  <Switch
                    checked={sortBy === 'name'}
                    onChange={() => setSortBy('name')}
                  />
                }
              >
                По названию
              </CellSimple>
            </CellList>
          </div>

          {/* Фильтр по исполнителю */}
          <div style={{ marginBottom: '24px' }}>
            <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
              Исполнитель
            </Typography.Body>
            <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
              {ASSIGNEES.map(assignee => (
                <CellSimple
                  key={assignee.id}
                  before={
                    <Switch
                      checked={selectedAssignees.includes(assignee.name)}
                      onChange={() => toggleAssignee(assignee.name)}
                    />
                  }
                >
                  {assignee.name}
                </CellSimple>
              ))}
            </CellList>
          </div>

          {/* Фильтр по приоритету */}
          <div style={{ marginBottom: '24px' }}>
            <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
              Приоритет
            </Typography.Body>
            <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
              {Object.entries(PRIORITIES).map(([key, value]) => (
                <CellSimple
                  key={key}
                  before={
                    <Switch
                      checked={selectedPriorities.includes(key)}
                      onChange={() => togglePriority(key)}
                    />
                  }
                  after={
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: value.color,
                      }}
                    />
                  }
                >
                  {value.label}
                </CellSimple>
              ))}
            </CellList>
          </div>

          {/* Фильтр по меткам */}
          <div style={{ marginBottom: '24px' }}>
            <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
              Метки
            </Typography.Body>
            <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
              {TAGS.map(tag => (
                <CellSimple
                  key={tag}
                  before={
                    <Switch
                      checked={selectedTags.includes(tag)}
                      onChange={() => toggleTag(tag)}
                    />
                  }
                >
                  {tag}
                </CellSimple>
              ))}
            </CellList>
          </div>

          <Button
            appearance="themed"
            mode="primary"
            size="large"
            stretched
            onClick={() => setIsFilterPanelOpen(false)}
          >
            Применить
          </Button>
        </div>
      </Panel>
        </div>
      )}

      {/* Модалка новой задачи */}
      {isNewTaskModalOpen && (
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
            resetNewTaskForm();
            setIsNewTaskModalOpen(false);
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
            {/* Заголовок */}
            <div style={{
              padding: '16px',
              borderBottom: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <Typography.Headline>Новая задача</Typography.Headline>
              <IconButton onClick={() => {
                resetNewTaskForm();
                setIsNewTaskModalOpen(false);
              }}>
                <X size={24} />
              </IconButton>
            </div>

            <div style={{ padding: '16px' }}>
              {/* Название задачи */}
              <div style={{ marginBottom: '16px' }}>
                <Input
                  mode="primary"
                  placeholder="Название задачи"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Описание */}
              <div style={{ marginBottom: '16px' }}>
                <Textarea
                  mode="primary"
                  placeholder="Описание (необязательно)"
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  rows={3}
                  style={{ width: '100%' }}
                />
              </div>

              {/* Опции задачи */}
              <CellList style={{ marginBottom: '16px' }}>
                {/* Приоритет */}
                <CellSimple
                  onClick={() => setShowPriorityPicker(true)}
                  before={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: PRIORITIES[newTaskPriority].color,
                        }}
                      />
                      <span>Приоритет</span>
                    </div>
                  }
                  after={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Typography.Body style={{ color: '#6B7280' }}>
                        {PRIORITIES[newTaskPriority].label}
                      </Typography.Body>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </div>
                  }
                />

                {/* Дедлайн */}
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
                        {newTaskDeadline
                          ? `${format(newTaskDeadline, 'd MMM', { locale: ru })}${newTaskTime ? `, ${newTaskTime}` : ''}`
                          : 'Без срока'}
                      </Typography.Body>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </div>
                  }
                />

                {/* Напоминание */}
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
                        {newTaskReminder || 'Не установлено'}
                      </Typography.Body>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </div>
                  }
                />

                {/* Метки */}
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
                        {newTaskTags.length > 0 ? newTaskTags.join(', ') : 'Не выбраны'}
                      </Typography.Body>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </div>
                  }
                />

                {/* Исполнитель */}
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
                        {newTaskAssignee}
                      </Typography.Body>
                      <ChevronRight size={20} color="#9CA3AF" />
                    </div>
                  }
                />
              </CellList>

              {/* Кнопки */}
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
                    resetNewTaskForm();
                    setIsNewTaskModalOpen(false);
                  }}
                >
                  Отмена
                </Button>
              </Flex>
            </div>
          </Panel>
        </div>
      )}

      {/* Выбор приоритета */}
      {showPriorityPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            paddingTop: '60px',
          }}
          onClick={() => setShowPriorityPicker(false)}
        >
          <Panel
            mode="primary"
            style={{
              width: '100%',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
              <Typography.Headline>Выбор приоритета</Typography.Headline>
            </div>
            <div style={{ padding: '16px' }}>
              <CellList>
                {Object.entries(PRIORITIES).map(([key, value]) => (
                  <CellSimple
                    key={key}
                    onClick={() => {
                      setNewTaskPriority(key as 'low' | 'medium' | 'high');
                      setShowPriorityPicker(false);
                    }}
                    before={
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          backgroundColor: value.color,
                        }}
                      />
                    }
                    after={
                      newTaskPriority === key && <CheckCircle2 size={20} color="#3B82F6" />
                    }
                  >
                    {value.label}
                  </CellSimple>
                ))}
              </CellList>
            </div>
          </Panel>
        </div>
      )}

      {/* Выбор дедлайна */}
      {showDeadlinePicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            paddingTop: '60px',
          }}
          onClick={() => setShowDeadlinePicker(false)}
        >
          <Panel
            mode="primary"
            style={{
              width: '100%',
              maxHeight: '80vh',
              overflowY: 'auto',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
              <Typography.Headline>Выбор дедлайна</Typography.Headline>
            </div>
            <div style={{ padding: '16px' }}>
              {/* Кнопка "Без срока" */}
              <Button
                appearance="neutral"
                mode="secondary"
                size="large"
                stretched
                onClick={() => {
                  setNewTaskDeadline(undefined);
                  setNewTaskTime('');
                  setShowDeadlinePicker(false);
                }}
                style={{ marginBottom: '16px' }}
              >
                Без срока
              </Button>

              {/* Календарь */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '16px',
              }}>
                <style>{`
                  .rdp-root {
                    --rdp-accent-color: #007aff;
                    --rdp-accent-background-color: #007aff;
                    --rdp-day-height: 44px;
                    --rdp-day-width: 44px;
                    --rdp-day_button-border-radius: 100%;
                    --rdp-day_button-border: 2px solid transparent;
                    --rdp-day_button-height: 42px;
                    --rdp-day_button-width: 42px;
                    --rdp-selected-border: 2px solid #007aff;
                    --rdp-disabled-opacity: 0.5;
                    --rdp-outside-opacity: 0.75;
                    --rdp-today-color: #007aff;
                  }
                  .rdp {
                    --rdp-cell-size: 40px;
                    --rdp-accent-color: #007aff;
                    --rdp-background-color: #007aff;
                    margin: 0;
                  }
                  .rdp-months {
                    justify-content: center;
                  }
                  .rdp-month {
                    width: 100%;
                    max-width: 320px;
                  }
                  .rdp-caption {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 8px;
                    margin-bottom: 8px;
                    position: relative;
                  }
                  .rdp-caption_label {
                    flex: 1;
                    justify-content: center;
                    text-align: center;
                    z-index: 1;
                  }
                  .rdp-nav {
                    position: absolute;
                    width: 100%;
                    display: flex;
                    justify-content: space-between;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 2;
                  }
                  .rdp-nav_button {
                    cursor: pointer;
                    background: white;
                    border: none;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 3;
                  }
                  .rdp-nav_button:hover {
                    background-color: #EFF6FF;
                    border-radius: 8px;
                  }
                  .rdp-nav_button:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                  }
                  .rdp-day_button {
                    -webkit-tap-highlight-color: transparent;
                    tap-highlight-color: transparent;
                  }
                  .rdp-day_button:active::before,
                  .rdp-day_button:focus::before {
                    display: none !important;
                  }
                  .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                    background-color: #EFF6FF;
                  }
                  .rdp-day_selected .rdp-day_button,
                  .rdp-day_selected .rdp-day_button:hover,
                  .rdp-day_selected .rdp-day_button:focus,
                  .rdp-day_selected .rdp-day_button:active {
                    background-color: #007aff !important;
                    color: white !important;
                    font-weight: normal !important;
                    border: none !important;
                    outline: none !important;
                    box-shadow: none !important;
                  }
                  .rdp-day_selected {
                    background-color: transparent !important;
                  }
                  .rdp-day_today:not(.rdp-day_selected) .rdp-day_button {
                    font-weight: bold;
                    color: #007aff;
                    background-color: transparent;
                  }
                  .rdp-day_today.rdp-day_selected .rdp-day_button {
                    background-color: #007aff !important;
                    color: white !important;
                    font-weight: normal !important;
                  }
                `}</style>
                <DayPicker
                  mode="single"
                  selected={newTaskDeadline}
                  onSelect={setNewTaskDeadline}
                  locale={ru}
                  disabled={{ before: new Date() }}
                />
              </div>

              {/* Выбор времени */}
              {newTaskDeadline && (
                <div style={{ marginBottom: '16px' }}>
                  <Input
                    mode="primary"
                    type="time"
                    placeholder="Время (необязательно)"
                    value={newTaskTime}
                    onChange={(e) => setNewTaskTime(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <Button
                appearance="themed"
                mode="primary"
                size="large"
                stretched
                onClick={() => setShowDeadlinePicker(false)}
              >
                Готово
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* Выбор напоминания */}
      {showReminderPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            paddingTop: '60px',
          }}
          onClick={() => setShowReminderPicker(false)}
        >
          <Panel
            mode="primary"
            style={{
              width: '100%',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
              <Typography.Headline>Напоминание</Typography.Headline>
            </div>
            <div style={{ padding: '16px' }}>
              <CellList>
                {['Не установлено', 'За 15 минут', 'За 30 минут', 'За 1 час', 'За 1 день'].map((reminder) => (
                  <CellSimple
                    key={reminder}
                    onClick={() => {
                      setNewTaskReminder(reminder === 'Не установлено' ? '' : reminder);
                      setShowReminderPicker(false);
                    }}
                    after={
                      newTaskReminder === (reminder === 'Не установлено' ? '' : reminder) &&
                      <CheckCircle2 size={20} color="#3B82F6" />
                    }
                  >
                    {reminder}
                  </CellSimple>
                ))}
              </CellList>
            </div>
          </Panel>
        </div>
      )}

      {/* Выбор меток */}
      {showTagsPicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            paddingTop: '60px',
          }}
          onClick={() => setShowTagsPicker(false)}
        >
          <Panel
            mode="primary"
            style={{
              width: '100%',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
              <Typography.Headline>Выбор меток</Typography.Headline>
            </div>
            <div style={{ padding: '16px' }}>
              <CellList>
                {TAGS.map((tag) => (
                  <CellSimple
                    key={tag}
                    before={
                      <Switch
                        checked={newTaskTags.includes(tag)}
                        onChange={() => toggleNewTaskTag(tag)}
                      />
                    }
                  >
                    {tag}
                  </CellSimple>
                ))}
              </CellList>
              <Button
                appearance="themed"
                mode="primary"
                size="large"
                stretched
                onClick={() => setShowTagsPicker(false)}
                style={{ marginTop: '16px' }}
              >
                Готово
              </Button>
            </div>
          </Panel>
        </div>
      )}

      {/* Выбор исполнителя */}
      {showAssigneePicker && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            paddingTop: '60px',
          }}
          onClick={() => setShowAssigneePicker(false)}
        >
          <Panel
            mode="primary"
            style={{
              width: '100%',
              borderTopLeftRadius: '16px',
              borderTopRightRadius: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
              <Typography.Headline>Выбор исполнителя</Typography.Headline>
            </div>
            <div style={{ padding: '16px' }}>
              <CellList>
                {ASSIGNEES.map((assignee) => (
                  <CellSimple
                    key={assignee.id}
                    onClick={() => {
                      setNewTaskAssignee(assignee.name);
                      setShowAssigneePicker(false);
                    }}
                    after={
                      newTaskAssignee === assignee.name &&
                      <CheckCircle2 size={20} color="#3B82F6" />
                    }
                  >
                    {assignee.name}
                  </CellSimple>
                ))}
              </CellList>
            </div>
          </Panel>
        </div>
      )}
    </ClientLayout>
  );
}

