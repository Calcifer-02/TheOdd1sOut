'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setTheme, updateTaskSettings, updateProfile } from '@/store/slices/settingsSlice';
import { useMaxUser } from '@/hooks/useMaxUser';
import CustomSelect from '@/components/ui/CustomSelect';
import {
    User,
    Palette,
    Bell,
    CheckSquare,
    Lock,
    Database,
    Info,
    ArrowLeft,
    Sun,
    Moon,
    Monitor,
    Download,
    Upload,
    RotateCcw,
    Trash2
} from 'lucide-react';
import styles from './settings.module.css';

type NotificationTime = 'morning' | 'afternoon' | 'evening' | 'disabled';

interface UserProfile {
    name: string;
    email: string;
    avatar: string;
}

interface NotificationSettings {
    enabled: boolean;
    sound: boolean;
    vibration: boolean;
    taskReminders: boolean;
    dailyReport: boolean;
    weeklyReport: boolean;
    deadlineAlerts: boolean;
    time: NotificationTime;
}

interface TaskSettings {
    defaultPriority: 'low' | 'medium' | 'high';
    autoArchive: boolean;
    archiveDays: number;
    showCompletedTasks: boolean;
    defaultView: 'list' | 'grid' | 'calendar';
    sortBy: 'date' | 'priority' | 'name' | 'deadline' | 'createdAt';
}

interface PrivacySettings {
    shareStatistics: boolean;
    publicProfile: boolean;
    showActivity: boolean;
}

export default function SettingsPage() {
    const dispatch = useAppDispatch();
    const currentTheme = useAppSelector((state) => state.settings?.theme || 'system');
    const reduxTaskSettings = useAppSelector((state) => state.settings?.taskSettings);
    const reduxProfile = useAppSelector((state) => state.settings?.profile);

    // Получаем данные из MAX
    const { user: maxUser } = useMaxUser();

    // Профиль пользователя - используем локальное состояние для формы
    const [profile, setProfile] = useState<UserProfile>(
        reduxProfile || {
            name: 'Пользователь',
            email: 'user@example.com',
            avatar: ''
        }
    );

    // Настройки уведомлений
    const [notifications, setNotifications] = useState<NotificationSettings>({
        enabled: true,
        sound: true,
        vibration: true,
        taskReminders: true,
        dailyReport: false,
        weeklyReport: true,
        deadlineAlerts: true,
        time: 'morning'
    });

    // Настройки задач - инициализируем из Redux с fallback
    const [taskSettings, setTaskSettings] = useState<TaskSettings>(
        reduxTaskSettings || {
            defaultPriority: 'medium',
            autoArchive: false,
            archiveDays: 30,
            showCompletedTasks: true,
            defaultView: 'list',
            sortBy: 'date'
        }
    );

    // Настройки приватности
    const [privacy, setPrivacy] = useState<PrivacySettings>({
        shareStatistics: false,
        publicProfile: false,
        showActivity: true
    });

    // Состояния UI
    const [activeSection, setActiveSection] = useState<string>('profile');
    const [isSaving, setIsSaving] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);

    // Загрузка настроек из localStorage (первым делом)
    useEffect(() => {
        const savedSettings = localStorage.getItem('userSettings');
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                if (parsed.profile) {
                    setProfile(parsed.profile);
                }
                if (parsed.notifications) setNotifications(parsed.notifications);
                if (parsed.taskSettings) setTaskSettings(parsed.taskSettings);
                if (parsed.privacy) setPrivacy(parsed.privacy);
                console.log('📦 Loaded settings from localStorage');
            } catch (error) {
                console.error('Ошибка загрузки настроек:', error);
            }
        }
        setIsInitialized(true);
    }, []);

    // Автозаполнение профиля данными из MAX (если профиль всё ещё пустой)
    useEffect(() => {
        if (!isInitialized || !maxUser) return;

        // Проверяем, что профиль действительно пустой (значения по умолчанию)
        const isDefaultProfile =
            profile.name === 'Пользователь' &&
            profile.email === 'user@example.com' &&
            profile.avatar === '';

        if (isDefaultProfile) {
            const maxName = `${maxUser.first_name}${maxUser.last_name ? ' ' + maxUser.last_name : ''}`;
            const maxEmail = maxUser.username || '';

            console.log('🔵 Auto-filling profile with MAX data:', { maxName, maxEmail });

            setProfile({
                name: maxName,
                email: maxEmail,
                avatar: ''
            });
        } else {
            console.log('✅ Profile already has data, skipping auto-fill');
        }
    }, [maxUser, isInitialized]); // Зависимость от isInitialized и maxUser

    // Применение темы
    useEffect(() => {
        const root = document.documentElement;

        if (currentTheme === 'dark') {
            root.classList.add('dark');
        } else if (currentTheme === 'light') {
            root.classList.remove('dark');
        } else {
            // system
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                root.classList.add('dark');
            } else {
                root.classList.remove('dark');
            }
        }
    }, [currentTheme]);


    // Сохранение настроек
    const saveSettings = () => {
        setIsSaving(true);

        const settings = {
            profile,
            notifications,
            taskSettings,
            privacy,
            savedAt: new Date().toISOString()
        };

        // Сохраняем в localStorage
        localStorage.setItem('userSettings', JSON.stringify(settings));

        // Синхронизируем с Redux Store
        dispatch(updateProfile(profile));
        dispatch(updateTaskSettings(taskSettings));

        console.log('Settings saved to Redux:', { profile, taskSettings }); // Debug log

        setTimeout(() => {
            setIsSaving(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 3000);
        }, 500);
    };


    // Сброс настроек
    const resetSettings = () => {
        if (confirm('Вы уверены, что хотите сбросить все настройки?')) {
            localStorage.removeItem('userSettings');
            setNotifications({
                enabled: true,
                sound: true,
                vibration: true,
                taskReminders: true,
                dailyReport: false,
                weeklyReport: true,
                deadlineAlerts: true,
                time: 'morning'
            });
            setTaskSettings({
                defaultPriority: 'medium',
                autoArchive: false,
                archiveDays: 30,
                showCompletedTasks: true,
                defaultView: 'list',
                sortBy: 'date'
            });
            setPrivacy({
                shareStatistics: false,
                publicProfile: false,
                showActivity: true
            });
            dispatch(setTheme('system'));
            saveSettings();
        }
    };

    // Экспорт данных
    const exportData = () => {
        const data = {
            profile,
            notifications,
            taskSettings,
            privacy,
            theme: currentTheme,
            exportedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `settings-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Импорт данных
    const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);
                if (data.profile) setProfile(data.profile);
                if (data.notifications) setNotifications(data.notifications);
                if (data.taskSettings) setTaskSettings(data.taskSettings);
                if (data.privacy) setPrivacy(data.privacy);
                if (data.theme) dispatch(setTheme(data.theme));
                saveSettings();
                alert('Настройки успешно импортированы!');
            } catch (error) {
                alert('Ошибка импорта настроек. Проверьте файл.');
            }
        };
        reader.readAsText(file);
    };

    const sections = [
        { id: 'profile', name: 'Профиль', Icon: User },
        { id: 'appearance', name: 'Внешний вид', Icon: Palette },
        { id: 'notifications', name: 'Уведомления', Icon: Bell },
        { id: 'tasks', name: 'Задачи', Icon: CheckSquare },
        { id: 'privacy', name: 'Приватность', Icon: Lock },
        { id: 'data', name: 'Данные', Icon: Database },
        { id: 'about', name: 'О приложении', Icon: Info }
    ];

    return (
        <div className={styles.container}>
            {/* Шапка */}
            <header className={styles.header}>
                <a href="/profile" className={styles.backButton}>
                    <ArrowLeft size={20} />
                    <span>Назад</span>
                </a>
                <h1 className={styles.title}>Настройки</h1>
                <button
                    className={styles.saveButton}
                    onClick={saveSettings}
                    disabled={isSaving}
                >
                    {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
            </header>

            {/* Уведомление об успехе */}
            {showSuccess && (
                <div className={styles.successMessage}>
                    ✓ Настройки сохранены
                </div>
            )}

            <div className={styles.content}>
                {/* Сетка с секциями */}
                <div className={styles.sectionsGrid}>
                    {sections.map(section => {
                        const IconComponent = section.Icon;
                        return (
                            <button
                                key={section.id}
                                className={`${styles.sectionCard} ${activeSection === section.id ? styles.sectionCardActive : ''}`}
                                onClick={() => setActiveSection(section.id)}
                            >
                                <IconComponent className={styles.sectionIcon} size={22} />
                                <span className={styles.sectionName}>{section.name}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Основной контент */}
                <main className={styles.main}>
                    {/* Профиль */}
                    {activeSection === 'profile' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Профиль пользователя</h2>


                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    Имя
                                    {maxUser && (
                                        <span className={styles.fieldHint}>
                                            (из MAX: {maxUser.first_name}{maxUser.last_name ? ' ' + maxUser.last_name : ''})
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={profile.name}
                                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                    placeholder="Введите ваше имя"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>
                                    Email / Username
                                    {maxUser?.username && (
                                        <span className={styles.fieldHint}>
                                            (из MAX: @{maxUser.username})
                                        </span>
                                    )}
                                </label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={profile.email}
                                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                    placeholder="email@example.com"
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Аватар URL</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={profile.avatar}
                                    onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}
                                    placeholder="https://example.com/avatar.jpg"
                                />
                                {profile.avatar && (
                                    <div className={styles.avatarPreview}>
                                        <img
                                            src={profile.avatar}
                                            alt="Avatar preview"
                                            className={styles.avatarImage}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Внешний вид */}
                    {activeSection === 'appearance' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Внешний вид</h2>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Тема оформления</label>
                                <div className={styles.themeSelector}>
                                    <button
                                        className={`${styles.themeButton} ${currentTheme === 'light' ? styles.themeButtonActive : ''}`}
                                        onClick={() => dispatch(setTheme('light'))}
                                    >
                                        <Sun size={20} />
                                        <span>Светлая</span>
                                    </button>
                                    <button
                                        className={`${styles.themeButton} ${currentTheme === 'dark' ? styles.themeButtonActive : ''}`}
                                        onClick={() => dispatch(setTheme('dark'))}
                                    >
                                        <Moon size={20} />
                                        <span>Тёмная</span>
                                    </button>
                                    <button
                                        className={`${styles.themeButton} ${currentTheme === 'system' ? styles.themeButtonActive : ''}`}
                                        onClick={() => dispatch(setTheme('system'))}
                                    >
                                        <Monitor size={20} />
                                        <span>Системная</span>
                                    </button>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Язык интерфейса</label>
                                <CustomSelect
                                    value="ru"
                                    onChange={() => {}}
                                    options={[
                                        { value: 'ru', label: 'Русский', icon: '🇷🇺' },
                                        { value: 'en', label: 'English', icon: '🇬🇧' }
                                    ]}
                                />
                            </div>
                        </div>
                    )}

                    {/* Уведомления */}
                    {activeSection === 'notifications' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Уведомления</h2>

                            <div className={styles.switchGroup}>
                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Включить уведомления</div>
                                        <div className={styles.switchDescription}>Получать push-уведомления</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.enabled}
                                            onChange={(e) => setNotifications({ ...notifications, enabled: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Звук</div>
                                        <div className={styles.switchDescription}>Звуковое оповещение</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.sound}
                                            onChange={(e) => setNotifications({ ...notifications, sound: e.target.checked })}
                                            disabled={!notifications.enabled}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Вибрация</div>
                                        <div className={styles.switchDescription}>Вибрационный отклик</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.vibration}
                                            onChange={(e) => setNotifications({ ...notifications, vibration: e.target.checked })}
                                            disabled={!notifications.enabled}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Напоминания о задачах</div>
                                        <div className={styles.switchDescription}>За 1 час до дедлайна</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.taskReminders}
                                            onChange={(e) => setNotifications({ ...notifications, taskReminders: e.target.checked })}
                                            disabled={!notifications.enabled}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Ежедневный отчет</div>
                                        <div className={styles.switchDescription}>Статистика за день</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.dailyReport}
                                            onChange={(e) => setNotifications({ ...notifications, dailyReport: e.target.checked })}
                                            disabled={!notifications.enabled}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Еженедельный отчет</div>
                                        <div className={styles.switchDescription}>Итоги недели</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.weeklyReport}
                                            onChange={(e) => setNotifications({ ...notifications, weeklyReport: e.target.checked })}
                                            disabled={!notifications.enabled}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Уведомления о дедлайнах</div>
                                        <div className={styles.switchDescription}>Срочные задачи</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={notifications.deadlineAlerts}
                                            onChange={(e) => setNotifications({ ...notifications, deadlineAlerts: e.target.checked })}
                                            disabled={!notifications.enabled}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Время отправки отчетов</label>
                                <CustomSelect
                                    value={notifications.time}
                                    onChange={(value) => setNotifications({ ...notifications, time: value as NotificationTime })}
                                    disabled={!notifications.enabled}
                                    options={[
                                        { value: 'morning', label: 'Утро (9:00)', icon: '🌅' },
                                        { value: 'afternoon', label: 'День (14:00)', icon: '☀️' },
                                        { value: 'evening', label: 'Вечер (20:00)', icon: '🌆' },
                                        { value: 'disabled', label: 'Отключено', icon: '❌' }
                                    ]}
                                />
                            </div>
                        </div>
                    )}

                    {/* Задачи */}
                    {activeSection === 'tasks' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Настройки задач</h2>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Приоритет по умолчанию</label>
                                <CustomSelect
                                    value={taskSettings.defaultPriority}
                                    onChange={(value) => setTaskSettings({ ...taskSettings, defaultPriority: value as 'low' | 'medium' | 'high' })}
                                    options={[
                                        { value: 'low', label: 'Низкий', icon: '🟢' },
                                        { value: 'medium', label: 'Средний', icon: '🟡' },
                                        { value: 'high', label: 'Высокий', icon: '🔴' }
                                    ]}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Вид отображения</label>
                                <CustomSelect
                                    value={taskSettings.defaultView}
                                    onChange={(value) => {
                                        const newView = value as 'list' | 'grid' | 'calendar';
                                        setTaskSettings({ ...taskSettings, defaultView: newView });
                                        // Сразу сохраняем в Redux для синхронизации с главной страницей
                                        dispatch(updateTaskSettings({ defaultView: newView }));
                                    }}
                                    options={[
                                        { value: 'list', label: 'Список'},
                                        { value: 'grid', label: 'Сетка' },
                                        { value: 'calendar', label: 'Календарь'}
                                    ]}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Сортировка</label>
                                <CustomSelect
                                    value={taskSettings.sortBy}
                                    onChange={(value) => {
                                        const newSort = value as 'date' | 'priority' | 'name' | 'deadline' | 'createdAt';
                                        setTaskSettings({ ...taskSettings, sortBy: newSort });
                                        // Сразу сохраняем в Redux для синхронизации с главной страницей
                                        dispatch(updateTaskSettings({ sortBy: newSort }));
                                    }}
                                    options={[
                                        { value: 'date', label: 'По дате' },
                                        { value: 'priority', label: 'По приоритету' },
                                        { value: 'name', label: 'По названию' }
                                    ]}
                                />
                            </div>

                            <div className={styles.switchGroup}>
                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Показывать выполненные</div>
                                        <div className={styles.switchDescription}>Отображать завершенные задачи</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={taskSettings.showCompletedTasks}
                                            onChange={(e) => setTaskSettings({ ...taskSettings, showCompletedTasks: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Автоматическая архивация</div>
                                        <div className={styles.switchDescription}>Архивировать старые задачи</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={taskSettings.autoArchive}
                                            onChange={(e) => setTaskSettings({ ...taskSettings, autoArchive: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>

                            {taskSettings.autoArchive && (
                                <div className={styles.formGroup}>
                                    <label className={styles.label}>Архивировать через (дней)</label>
                                    <input
                                        type="number"
                                        className={styles.input}
                                        value={taskSettings.archiveDays}
                                        onChange={(e) => setTaskSettings({ ...taskSettings, archiveDays: parseInt(e.target.value) || 30 })}
                                        min="1"
                                        max="365"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Приватность */}
                    {activeSection === 'privacy' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Приватность и безопасность</h2>

                            <div className={styles.switchGroup}>
                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Публичный профиль</div>
                                        <div className={styles.switchDescription}>Другие пользователи могут видеть ваш профиль</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={privacy.publicProfile}
                                            onChange={(e) => setPrivacy({ ...privacy, publicProfile: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Делиться статистикой</div>
                                        <div className={styles.switchDescription}>Отправлять анонимную статистику использования</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={privacy.shareStatistics}
                                            onChange={(e) => setPrivacy({ ...privacy, shareStatistics: e.target.checked })}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>

                                <div className={styles.switchItem}>
                                    <div>
                                        <div className={styles.switchLabel}>Показывать активность</div>
                                        <div className={styles.switchDescription}>Отображать вашу активность другим</div>
                                    </div>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={privacy.showActivity}
                                            onChange={(e) => setPrivacy({ ...privacy, showActivity: e.target.checked })}
                                            disabled={!privacy.publicProfile}
                                        />
                                        <span className={styles.slider}></span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Данные */}
                    {activeSection === 'data' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>Управление данными</h2>

                            <div className={styles.dataActions}>
                                <button className={styles.actionButton} onClick={exportData}>
                                    <Download className={styles.actionIcon} size={32} />
                                    <div>
                                        <div className={styles.actionTitle}>Экспорт настроек</div>
                                        <div className={styles.actionDescription}>Сохранить настройки в файл</div>
                                    </div>
                                </button>

                                <label className={styles.actionButton}>
                                    <Upload className={styles.actionIcon} size={32} />
                                    <div>
                                        <div className={styles.actionTitle}>Импорт настроек</div>
                                        <div className={styles.actionDescription}>Загрузить настройки из файла</div>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".json"
                                        onChange={importData}
                                        style={{ display: 'none' }}
                                    />
                                </label>

                                <button
                                    className={`${styles.actionButton} ${styles.dangerButton}`}
                                    onClick={resetSettings}
                                >
                                    <RotateCcw className={styles.actionIcon} size={32} />
                                    <div>
                                        <div className={styles.actionTitle}>Сбросить настройки</div>
                                        <div className={styles.actionDescription}>Вернуть значения по умолчанию</div>
                                    </div>
                                </button>

                                <button
                                    className={`${styles.actionButton} ${styles.dangerButton}`}
                                    onClick={() => {
                                        if (confirm('Вы уверены? Все данные будут удалены безвозвратно!')) {
                                            localStorage.clear();
                                            alert('Все данные удалены. Перезагрузите страницу.');
                                        }
                                    }}
                                >
                                    <Trash2 className={styles.actionIcon} size={32} />
                                    <div>
                                        <div className={styles.actionTitle}>Удалить все данные</div>
                                        <div className={styles.actionDescription}>Очистить localStorage</div>
                                    </div>
                                </button>
                            </div>

                            <div className={styles.storageInfo}>
                                <h3 className={styles.storageTitle}>Использование памяти</h3>
                                <div className={styles.storageItem}>
                                    <span>Настройки:</span>
                                    <span>{(new Blob([localStorage.getItem('userSettings') || '']).size / 1024).toFixed(2)} KB</span>
                                </div>
                                <div className={styles.storageItem}>
                                    <span>Всего в localStorage:</span>
                                    <span>{(new Blob([JSON.stringify(localStorage)]).size / 1024).toFixed(2)} KB</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* О приложении */}
                    {activeSection === 'about' && (
                        <div className={styles.section}>
                            <h2 className={styles.sectionTitle}>О приложении</h2>

                            <div className={styles.aboutInfo}>
                                <div className={styles.appIcon}>MAX</div>
                                <h3 className={styles.appName}>MAX Task Manager</h3>
                                <p className={styles.appVersion}>Версия 1.0.0</p>

                                <div className={styles.aboutSection}>
                                    <h4>Описание</h4>
                                    <p>MAX - современное приложение для управления задачами с расширенной аналитикой и гибкими настройками.</p>
                                </div>

                                <div className={styles.aboutSection}>
                                    <h4>Технологии</h4>
                                    <ul className={styles.techList}>
                                        <li>Next.js 14</li>
                                        <li>React 18</li>
                                        <li>Redux Toolkit</li>
                                        <li>TypeScript</li>
                                        <li>Supabase</li>
                                    </ul>
                                </div>

                                <div className={styles.aboutSection}>
                                    <h4>Ссылки</h4>
                                    <div className={styles.links}>
                                        <Link href="/privacy" className={styles.link}>Политика конфиденциальности</Link>
                                        <Link href="/terms" className={styles.link}>Условия использования</Link>
                                        <Link href="/support" className={styles.link}>Поддержка</Link>
                                        <Link href="https://github.com/Calcifer-02" className={styles.link} target="_blank" rel="noopener noreferrer">GitHub</Link>
                                    </div>
                                </div>

                                <div className={styles.copyright}>
                                    © 2025 MAX. Все права защищены.
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

