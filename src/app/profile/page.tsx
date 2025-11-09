'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { UserCircleIcon, SearchIcon, Settings2Icon } from '@/components/icons';
import { Task } from '@/types/task';
import styles from './profile.module.css';

interface CompletedTask {
    id: number;
    task_id: number | null;
    title: string;
    description: string | null;
    priority: 'low' | 'medium' | 'high';
    assignee: string;
    tags: string[];
    completed_at: string;
    original_created_at: string | null;
    original_deadline: string | null;
}

interface DailyStat {
    id: number;
    date: string;
    tasks_completed: number;
    goal: number;
    created_at: string;
    updated_at: string;
}

export default function ProfilePage() {
    const [userName, setUserName] = useState('Пользователь');
    const [totalCompleted, setTotalCompleted] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<any>(null);
    const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
    const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'analytics'>('overview');

    // Загрузка данных при монтировании
    useEffect(() => {
        loadProfileData();
    }, []);

    // Закрытие модалки по ESC
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isSearchModalOpen) {
                setIsSearchModalOpen(false);
                setSearchQuery('');
            }
        };

        if (isSearchModalOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [isSearchModalOpen]);

    const loadProfileData = async () => {
        try {
            setLoading(true);

            // Загрузка текущих задач
            const { data: tasksData, error: tasksError } = await supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });

            if (tasksError) throw tasksError;
            setCurrentTasks(tasksData || []);

            // Загрузка выполненных задач
            const { data: completedData, error: completedError } = await supabase
                .from('completed_tasks')
                .select('*')
                .order('completed_at', { ascending: false });

            if (completedError) {
                // Если таблица не существует, просто устанавливаем пустой массив
                console.warn('Таблица completed_tasks не найдена:', completedError);
                setCompletedTasks([]);
            } else {
                setCompletedTasks(completedData || []);
                setTotalCompleted((completedData || []).length);
            }

            // Загрузка статистики
            const { data: statsData, error: statsError } = await supabase
                .from('daily_stats')
                .select('*')
                .order('date', { ascending: false })
                .limit(7);

            if (statsError) {
                console.warn('Таблица daily_stats не найдена:', statsError);
                setDailyStats([]);
            } else {
                setDailyStats(statsData || []);
            }

        } catch (error) {
            console.error('Ошибка загрузки данных профиля:', error);
        } finally {
            setLoading(false);
        }
    };

    // Фильтрация задач по поиску
    const filteredTasks = useMemo(() => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return [];

        const allTasks = [
            ...currentTasks.map(t => ({ ...t, isCompleted: t.completed })),
            ...completedTasks.map(t => ({
                id: t.id,
                title: t.title,
                description: t.description,
                priority: t.priority,
                assignee: t.assignee,
                tags: t.tags,
                completed: true,
                isCompleted: true,
                deadline: t.original_deadline,
                order: 0,
                created_at: t.original_created_at || t.completed_at,
                updated_at: t.completed_at
            }))
        ];

        return allTasks.filter(task =>
            task.title.toLowerCase().includes(query) ||
            (task.description && task.description.toLowerCase().includes(query)) ||
            task.tags.some(tag => tag.toLowerCase().includes(query))
        );
    }, [searchQuery, currentTasks, completedTasks]);

    // Расчет статистики для дня
    const todayStats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayStat = dailyStats.find(s => s.date === today);

        if (todayStat) {
            return {
                completed: todayStat.tasks_completed,
                goal: todayStat.goal,
                percentage: Math.round((todayStat.tasks_completed / todayStat.goal) * 100)
            };
        }

        const todayCompleted = completedTasks.filter(t => {
            const completedDate = new Date(t.completed_at).toISOString().split('T')[0];
            return completedDate === today;
        }).length;

        return {
            completed: todayCompleted,
            goal: 5,
            percentage: Math.round((todayCompleted / 5) * 100)
        };
    }, [dailyStats, completedTasks]);

    // Расчет статистики для недели
    const weekStats = useMemo(() => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const weekCompleted = completedTasks.filter(t => {
            const completedDate = new Date(t.completed_at);
            return completedDate >= oneWeekAgo;
        }).length;

        const weekGoal = 25;

        return {
            completed: weekCompleted,
            goal: weekGoal,
            percentage: Math.round((weekCompleted / weekGoal) * 100)
        };
    }, [completedTasks]);

    // Уровень (простая формула на основе общего числа задач)
    const level = useMemo(() => {
        return Math.floor(totalCompleted / 10) + 1;
    }, [totalCompleted]);

    // Расширенная аналитика
    const analytics = useMemo(() => {
        // Распределение по приоритетам
        const priorityDistribution = {
            high: completedTasks.filter(t => t.priority === 'high').length,
            medium: completedTasks.filter(t => t.priority === 'medium').length,
            low: completedTasks.filter(t => t.priority === 'low').length,
        };

        // Популярные теги
        const tagsCount: Record<string, number> = {};
        completedTasks.forEach(task => {
            task.tags.forEach(tag => {
                tagsCount[tag] = (tagsCount[tag] || 0) + 1;
            });
        });
        const topTags = Object.entries(tagsCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        // Серия (streak) - дни подряд с выполненными задачами
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toISOString().split('T')[0];

            const hasTasksOnDate = completedTasks.some(t => {
                const taskDate = new Date(t.completed_at).toISOString().split('T')[0];
                return taskDate === dateStr;
            });

            if (hasTasksOnDate) {
                streak++;
            } else if (i > 0) {
                break; // Прерываем серию
            }
        }

        // Продуктивность по дням недели
        const weekdayStats = [0, 0, 0, 0, 0, 0, 0]; // Вс-Сб
        completedTasks.forEach(task => {
            const day = new Date(task.completed_at).getDay();
            weekdayStats[day]++;
        });

        // Среднее время выполнения (в часах)
        let totalTimeHours = 0;
        let tasksWithTime = 0;
        completedTasks.forEach(task => {
            if (task.original_created_at && task.completed_at) {
                const created = new Date(task.original_created_at).getTime();
                const completed = new Date(task.completed_at).getTime();
                const hours = (completed - created) / (1000 * 60 * 60);
                if (hours > 0 && hours < 24 * 30) { // Игнорируем аномалии > 30 дней
                    totalTimeHours += hours;
                    tasksWithTime++;
                }
            }
        });
        const avgCompletionTime = tasksWithTime > 0 ? totalTimeHours / tasksWithTime : 0;

        // Эффективность (выполненные vs всего созданных)
        const totalTasks = currentTasks.length + completedTasks.length;
        const efficiency = totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 : 0;

        // Активность за последние 7 дней
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const count = completedTasks.filter(t => {
                const taskDate = new Date(t.completed_at).toISOString().split('T')[0];
                return taskDate === dateStr;
            }).length;
            last7Days.push({
                date: dateStr,
                count,
                dayName: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][date.getDay()]
            });
        }

        return {
            priorityDistribution,
            topTags,
            streak,
            weekdayStats,
            avgCompletionTime,
            efficiency,
            last7Days,
            totalTasks,
            activeTasks: currentTasks.length
        };
    }, [completedTasks, currentTasks]);

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loading}>Загрузка...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Шапка профиля */}
            <header className={styles.header}>
                <div className={styles.profileInfo}>
                    <div className={styles.avatarWrapper}>
                        <UserCircleIcon />
                    </div>
                    <div className={styles.userInfo}>
                        <h1 className={styles.userName}>{userName}</h1>
                        <div className={styles.totalCompleted}>
                            Выполнено задач: <span className={styles.badge}>{totalCompleted}</span>
                        </div>
                    </div>
                </div>
                <button
                    className={styles.settingsButton}
                    onClick={() => window.location.href = '/settings'}
                    aria-label="Настройки"
                >
                    <Settings2Icon />
                </button>
            </header>

            {/* Основной контент */}
            <div className={styles.content}>
                {/* Поиск - кнопка открытия модального окна */}
                <div className={styles.searchSection}>
                    <div
                        className={styles.searchBox}
                        onClick={() => setIsSearchModalOpen(true)}
                    >
                        <SearchIcon />
                        <input
                            type="text"
                            placeholder="Поиск по задачам..."
                            className={styles.searchInput}
                            onFocus={() => setIsSearchModalOpen(true)}
                            readOnly
                        />
                    </div>
                </div>

                {/* Вкладки */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Обзор
                    </button>
                    <button
                        className={`${styles.tab} ${activeTab === 'analytics' ? styles.tabActive : ''}`}
                        onClick={() => setActiveTab('analytics')}
                    >
                        Аналитика
                    </button>
                </div>

                {/* Статистика - Обзор */}
                {activeTab === 'overview' && (
                    <div className={styles.statsGrid}>
                        {/* День */}
                        <div className={styles.statCard}>
                            <h3 className={styles.statTitle}>День</h3>
                            <div className={styles.statContent}>
                                <div className={styles.progressCircle}>
                                    <svg className={styles.progressSvg} viewBox="0 0 100 100">
                                        <circle
                                            className={styles.progressBackground}
                                            cx="50"
                                            cy="50"
                                            r="45"
                                        />
                                        <circle
                                            className={styles.progressFill}
                                            cx="50"
                                            cy="50"
                                            r="45"
                                            strokeDasharray={`${todayStats.percentage * 2.827} 283`}
                                        />
                                    </svg>
                                    <div className={styles.progressText}>
                                        {todayStats.percentage}%
                                    </div>
                                </div>
                                <div className={styles.statDetails}>
                                    <p className={styles.statNumbers}>
                                        {todayStats.completed} / {todayStats.goal}
                                    </p>
                                    <p className={styles.statLabel}>задач</p>
                                </div>
                            </div>
                        </div>

                        {/* Уровень */}
                        <div className={styles.statCard}>
                            <h3 className={styles.statTitle}>Уровень</h3>
                            <div className={styles.statContent}>
                                <div className={styles.levelDisplay}>
                                    <div className={styles.levelNumber}>{level}</div>
                                </div>
                                <div className={styles.statDetails}>
                                    <p className={styles.statNumbers}>
                                        {totalCompleted} задач
                                    </p>
                                    <p className={styles.statLabel}>
                                        До {level + 1} уровня: {((level + 1) * 10) - totalCompleted}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Неделя */}
                        <div className={styles.statCard}>
                            <h3 className={styles.statTitle}>Неделя</h3>
                            <div className={styles.statContent}>
                                <div className={styles.progressCircle}>
                                    <svg className={styles.progressSvg} viewBox="0 0 100 100">
                                        <circle
                                            className={styles.progressBackground}
                                            cx="50"
                                            cy="50"
                                            r="45"
                                        />
                                        <circle
                                            className={styles.progressFill}
                                            cx="50"
                                            cy="50"
                                            r="45"
                                            strokeDasharray={`${weekStats.percentage * 2.827} 283`}
                                        />
                                    </svg>
                                    <div className={styles.progressText}>
                                        {weekStats.percentage}%
                                    </div>
                                </div>
                                <div className={styles.statDetails}>
                                    <p className={styles.statNumbers}>
                                        {weekStats.completed} / {weekStats.goal}
                                    </p>
                                    <p className={styles.statLabel}>задач</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Детальная аналитика */}
                {activeTab === 'analytics' && (
                    <div className={styles.analyticsContainer}>
                        {/* Общая статистика */}
                        <div className={styles.analyticsCard}>
                            <h3 className={styles.analyticsCardTitle}>Общая статистика</h3>
                            <div className={styles.statsRow}>
                                <div className={styles.statItem}>
                                    <div className={styles.statItemValue}>{analytics.totalTasks}</div>
                                    <div className={styles.statItemLabel}>Всего задач</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statItemValue}>{totalCompleted}</div>
                                    <div className={styles.statItemLabel}>Выполнено</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statItemValue}>{analytics.activeTasks}</div>
                                    <div className={styles.statItemLabel}>Активных</div>
                                </div>
                                <div className={styles.statItem}>
                                    <div className={styles.statItemValue}>{analytics.efficiency.toFixed(0)}%</div>
                                    <div className={styles.statItemLabel}>Эффективность</div>
                                </div>
                            </div>
                        </div>

                        {/* Серия и среднее время */}
                        <div className={styles.analyticsRow}>
                            <div className={styles.analyticsCard}>
                                <h3 className={styles.analyticsCardTitle}>🔥 Серия</h3>
                                <div className={styles.streakValue}>{analytics.streak}</div>
                                <div className={styles.streakLabel}>
                                    {analytics.streak === 1 ? 'день подряд' : analytics.streak < 5 ? 'дня подряд' : 'дней подряд'}
                                </div>
                            </div>
                            <div className={styles.analyticsCard}>
                                <h3 className={styles.analyticsCardTitle}>⏱️ Среднее время</h3>
                                <div className={styles.streakValue}>
                                    {analytics.avgCompletionTime > 24
                                        ? `${Math.round(analytics.avgCompletionTime / 24)}д`
                                        : `${Math.round(analytics.avgCompletionTime)}ч`
                                    }
                                </div>
                                <div className={styles.streakLabel}>на выполнение</div>
                            </div>
                        </div>

                        {/* График активности за 7 дней */}
                        <div className={styles.analyticsCard}>
                            <h3 className={styles.analyticsCardTitle}>Активность за неделю</h3>
                            <div className={styles.activityChart}>
                                {analytics.last7Days.map((day, index) => (
                                    <div key={index} className={styles.activityDay}>
                                        <div className={styles.activityBar}>
                                            <div
                                                className={styles.activityBarFill}
                                                style={{
                                                    height: `${Math.min((day.count / Math.max(...analytics.last7Days.map(d => d.count), 1)) * 100, 100)}%`,
                                                    background: day.count > 0 ? '#0077FF' : '#E8EAED'
                                                }}
                                            />
                                        </div>
                                        <div className={styles.activityLabel}>{day.dayName}</div>
                                        <div className={styles.activityCount}>{day.count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Распределение по приоритетам */}
                        <div className={styles.analyticsCard}>
                            <h3 className={styles.analyticsCardTitle}>Распределение по приоритетам</h3>
                            <div className={styles.priorityBars}>
                                <div className={styles.priorityBar}>
                                    <div className={styles.priorityInfo}>
                                        <span className={`${styles.priorityDot} ${styles.high}`}></span>
                                        <span className={styles.priorityName}>Высокий</span>
                                        <span className={styles.priorityCount}>{analytics.priorityDistribution.high}</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div
                                            className={`${styles.progressBarFill} ${styles.high}`}
                                            style={{
                                                width: `${totalCompleted > 0 ? (analytics.priorityDistribution.high / totalCompleted) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.priorityBar}>
                                    <div className={styles.priorityInfo}>
                                        <span className={`${styles.priorityDot} ${styles.medium}`}></span>
                                        <span className={styles.priorityName}>Средний</span>
                                        <span className={styles.priorityCount}>{analytics.priorityDistribution.medium}</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div
                                            className={`${styles.progressBarFill} ${styles.medium}`}
                                            style={{
                                                width: `${totalCompleted > 0 ? (analytics.priorityDistribution.medium / totalCompleted) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className={styles.priorityBar}>
                                    <div className={styles.priorityInfo}>
                                        <span className={`${styles.priorityDot} ${styles.low}`}></span>
                                        <span className={styles.priorityName}>Низкий</span>
                                        <span className={styles.priorityCount}>{analytics.priorityDistribution.low}</span>
                                    </div>
                                    <div className={styles.progressBar}>
                                        <div
                                            className={`${styles.progressBarFill} ${styles.low}`}
                                            style={{
                                                width: `${totalCompleted > 0 ? (analytics.priorityDistribution.low / totalCompleted) * 100 : 0}%`
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Популярные теги */}
                        {analytics.topTags.length > 0 && (
                            <div className={styles.analyticsCard}>
                                <h3 className={styles.analyticsCardTitle}>Популярные теги</h3>
                                <div className={styles.topTagsList}>
                                    {analytics.topTags.map(([tag, count], index) => (
                                        <div key={tag} className={styles.topTagItem}>
                                            <span className={styles.topTagRank}>#{index + 1}</span>
                                            <span className={styles.topTagName}>{tag}</span>
                                            <span className={styles.topTagCount}>{count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Продуктивность по дням недели */}
                        <div className={styles.analyticsCard}>
                            <h3 className={styles.analyticsCardTitle}>Продуктивность по дням недели</h3>
                            <div className={styles.weekdayChart}>
                                {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'].map((day, index) => (
                                    <div key={day} className={styles.weekdayBar}>
                                        <div className={styles.weekdayBarContainer}>
                                            <div
                                                className={styles.weekdayBarFill}
                                                style={{
                                                    height: `${Math.min((analytics.weekdayStats[index] / Math.max(...analytics.weekdayStats, 1)) * 100, 100)}%`
                                                }}
                                            />
                                        </div>
                                        <div className={styles.weekdayLabel}>{day}</div>
                                        <div className={styles.weekdayCount}>{analytics.weekdayStats[index]}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Модальное окно поиска */}
            {isSearchModalOpen && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => {
                        setIsSearchModalOpen(false);
                        setSearchQuery('');
                    }}
                >
                    <div
                        className={styles.modalContent}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.modalHeader}>
                            <div className={styles.modalSearchBox}>
                                <SearchIcon />
                                <input
                                    type="text"
                                    placeholder="Поиск по задачам..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={styles.modalSearchInput}
                                    autoFocus
                                />
                            </div>
                            <button
                                className={styles.closeButton}
                                onClick={() => {
                                    setIsSearchModalOpen(false);
                                    setSearchQuery('');
                                }}
                            >
                                ×
                            </button>
                        </div>

                        <div className={styles.modalBody}>
                            {searchQuery ? (
                                filteredTasks.length > 0 ? (
                                    <ul className={styles.tasksList}>
                                        {filteredTasks.slice(0, 50).map((task) => (
                                            <li
                                                key={`${task.isCompleted ? 'completed' : 'current'}-${task.id}`}
                                                className={styles.taskItem}
                                                onClick={() => {
                                                    setSelectedTask(task);
                                                    setIsSearchModalOpen(false);
                                                }}
                                            >
                                                <div className={styles.taskHeader}>
                                                    <span className={styles.taskTitle}>{task.title}</span>
                                                    {task.isCompleted && (
                                                        <span className={styles.completedBadge}>✓</span>
                                                    )}
                                                </div>
                                                {task.description && (
                                                    <p className={styles.taskDescription}>{task.description}</p>
                                                )}
                                                <div className={styles.taskMeta}>
                                                    <span className={`${styles.priority} ${styles[task.priority]}`}>
                                                        {task.priority === 'high' ? 'Высокий' :
                                                            task.priority === 'medium' ? 'Средний' : 'Низкий'}
                                                    </span>
                                                    {task.tags.length > 0 && (
                                                        <span className={styles.tags}>
                                                            {task.tags.join(', ')}
                                                        </span>
                                                    )}
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className={styles.noResults}>Ничего не найдено</p>
                                )
                            ) : (
                                <p className={styles.emptyState}>Начните вводить для поиска...</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно с деталями задачи */}
            {selectedTask && (
                <div
                    className={styles.modalOverlay}
                    onClick={() => setSelectedTask(null)}
                >
                    <div
                        className={styles.taskDetailModal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className={styles.taskDetailHeader}>
                            <h2 className={styles.taskDetailTitle}>
                                {selectedTask.title}
                                {selectedTask.isCompleted && (
                                    <span className={styles.completedBadge}>✓</span>
                                )}
                            </h2>
                            <button
                                className={styles.closeButton}
                                onClick={() => setSelectedTask(null)}
                            >
                                ×
                            </button>
                        </div>

                        <div className={styles.taskDetailBody}>
                            {/* Статус */}
                            <div className={styles.detailSection}>
                                <div className={styles.detailLabel}>Статус</div>
                                <div className={styles.detailValue}>
                                    {selectedTask.isCompleted ? (
                                        <span className={styles.statusCompleted}>Выполнено</span>
                                    ) : (
                                        <span className={styles.statusActive}>Активная</span>
                                    )}
                                </div>
                            </div>

                            {/* Приоритет */}
                            <div className={styles.detailSection}>
                                <div className={styles.detailLabel}>Приоритет</div>
                                <div className={styles.detailValue}>
                                    <span className={`${styles.priority} ${styles[selectedTask.priority]}`}>
                                        {selectedTask.priority === 'high' ? 'Высокий' :
                                            selectedTask.priority === 'medium' ? 'Средний' : 'Низкий'}
                                    </span>
                                </div>
                            </div>

                            {/* Описание */}
                            {selectedTask.description && (
                                <div className={styles.detailSection}>
                                    <div className={styles.detailLabel}>Описание</div>
                                    <div className={styles.detailValue}>
                                        {selectedTask.description}
                                    </div>
                                </div>
                            )}

                            {/* Исполнитель */}
                            <div className={styles.detailSection}>
                                <div className={styles.detailLabel}>Исполнитель</div>
                                <div className={styles.detailValue}>
                                    {selectedTask.assignee}
                                </div>
                            </div>

                            {/* Теги */}
                            {selectedTask.tags && selectedTask.tags.length > 0 && (
                                <div className={styles.detailSection}>
                                    <div className={styles.detailLabel}>Теги</div>
                                    <div className={styles.detailValue}>
                                        <div className={styles.tagsList}>
                                            {selectedTask.tags.map((tag: string, index: number) => (
                                                <span key={index} className={styles.tag}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Дедлайн */}
                            {selectedTask.deadline && (
                                <div className={styles.detailSection}>
                                    <div className={styles.detailLabel}>Дедлайн</div>
                                    <div className={styles.detailValue}>
                                        {new Date(selectedTask.deadline).toLocaleString('ru-RU', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Дата создания */}
                            {selectedTask.created_at && (
                                <div className={styles.detailSection}>
                                    <div className={styles.detailLabel}>Создано</div>
                                    <div className={styles.detailValue}>
                                        {new Date(selectedTask.created_at).toLocaleString('ru-RU', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            )}
                            {selectedTask.isCompleted && selectedTask.updated_at && (
                                <div className={styles.detailSection}>
                                    <div className={styles.detailLabel}>Выполнено</div>
                                    <div className={styles.detailValue}>
                                        {new Date(selectedTask.updated_at).toLocaleString('ru-RU', {
                                            day: '2-digit',
                                            month: 'long',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}