'use client';

import { useEffect, useState } from 'react';
import { getMoodTestStats, getMoodTestChartData, MoodTestStats } from '@/services/moodTestService';
import { BarChart3, TrendingUp, TrendingDown, Minus, HelpCircle, Activity, Brain } from 'lucide-react';
import AIAdvice from '@/components/mood/AIAdvice';
import styles from './MoodAnalytics.module.css';

interface MoodAnalyticsProps {
  userId: number;
}

interface ChartDataPoint {
  date: string;
  totalScore: number;
  stressScore: number;
  copingScore: number;
  level: string;
}

export default function MoodAnalytics({ userId }: MoodAnalyticsProps) {
  const [stats, setStats] = useState<MoodTestStats | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  // Логируем user_id сразу при рендере
  console.log('='.repeat(50));
  console.log('[MoodAnalytics] Component rendered with userId:', userId);
  console.log('[MoodAnalytics] userId type:', typeof userId);
  console.log('='.repeat(50));

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      console.log('[MoodAnalytics] Loading data for userId:', userId);
      setLoading(true);

      const [statsData, chartDataResult] = await Promise.all([
        getMoodTestStats(userId),
        getMoodTestChartData(userId, 10)
      ]);

      console.log('[MoodAnalytics] Stats loaded:', statsData);
      console.log('[MoodAnalytics] Chart data loaded:', chartDataResult?.length || 0, 'records');

      setStats(statsData);
      setChartData(chartDataResult);
    } catch (error) {
      console.error('[MoodAnalytics] Failed to load mood analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <div className={styles.spinner}></div>
          <p>Загрузка аналитики...</p>
        </div>
      </div>
    );
  }

  if (!stats || stats.tests_count === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <BarChart3 size={64} color="var(--text-secondary)" strokeWidth={1.5} />
          </div>
          <h3 className={styles.emptyTitle}>Нет данных для аналитики</h3>
          <p className={styles.emptyText}>
            Пройдите тест PSS, чтобы начать отслеживать динамику вашего психологического состояния
          </p>

          <button
            className={styles.debugButton}
            onClick={() => setDebugMode(!debugMode)}
          >
            {debugMode ? 'Скрыть отладку' : 'Показать отладку'}
          </button>

          {debugMode && (
            <div className={styles.debugInfo}>
              <h4>Отладочная информация:</h4>
              <p><strong>User ID:</strong> {userId}</p>
              <p><strong>Stats:</strong> {JSON.stringify(stats, null, 2)}</p>
              <p><strong>Загружено записей:</strong> {chartData.length}</p>
              <p>
                <strong>Проверьте:</strong> Откройте консоль браузера (F12) и посмотрите логи с префиксом [MoodAnalytics]
              </p>
              <p>
                <strong>Тестовый endpoint:</strong>{' '}
                <a
                  href={`/api/mood/test?userId=${userId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  /api/mood/test?userId={userId}
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const getTrendIcon = () => {
    const iconSize = 24;
    switch (stats.trend) {
      case 'improving':
        return <TrendingDown size={iconSize} color="#10b981" />;
      case 'worsening':
        return <TrendingUp size={iconSize} color="#ef4444" />;
      case 'stable':
        return <Minus size={iconSize} color="#3b82f6" />;
      default:
        return <HelpCircle size={iconSize} color="#9ca3af" />;
    }
  };

  const getTrendText = () => {
    switch (stats.trend) {
      case 'improving':
        return 'Улучшение';
      case 'worsening':
        return 'Ухудшение';
      case 'stable':
        return 'Стабильно';
      default:
        return 'Недостаточно данных';
    }
  };

  const getTrendColor = () => {
    switch (stats.trend) {
      case 'improving':
        return styles.trendImproving;
      case 'worsening':
        return styles.trendWorsening;
      case 'stable':
        return styles.trendStable;
      default:
        return styles.trendInsufficient;
    }
  };

  const getStressLevelColor = (score: number) => {
    if (score <= 20) return styles.levelLow;
    if (score <= 30) return styles.levelMedium;
    return styles.levelHigh;
  };

  const getStressLevelText = (score: number) => {
    if (score <= 20) return 'Низкий';
    if (score <= 30) return 'Умеренный';
    return 'Высокий';
  };

  return (
    <div className={styles.container}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <BarChart3 size={32} color="var(--primary)" strokeWidth={2} />
          </div>
          <div className={styles.statValue}>{stats.tests_count}</div>
          <div className={styles.statLabel}>Пройдено тестов</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>
            <Activity size={32} color="var(--primary)" strokeWidth={2} />
          </div>
          <div className={styles.statValue}>{stats.average_total_score}</div>
          <div className={styles.statLabel}>Средний балл</div>
          <div className={`${styles.statBadge} ${getStressLevelColor(stats.average_total_score)}`}>
            {getStressLevelText(stats.average_total_score)}
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>{getTrendIcon()}</div>
          <div className={styles.statValue}>Тренд</div>
          <div className={`${styles.statBadge} ${getTrendColor()}`}>
            {getTrendText()}
          </div>
        </div>
      </div>

      <div className={styles.chartContainer}>
        <h3 className={styles.chartTitle}>Динамика изменений</h3>
        <p className={styles.chartSubtitle}>
          {chartData.length > 0
            ? `Последние ${chartData.length} тестов`
            : 'Нет данных для отображения'}
        </p>

        {chartData.length > 0 && (
          <div className={styles.chartWrapper}>
            <div className={styles.chart}>
              <div className={styles.chartYAxis}>
                <span className={styles.yLabel}>50</span>
                <span className={styles.yLabel}>40</span>
                <span className={styles.yLabel}>30</span>
                <span className={styles.yLabel}>20</span>
                <span className={styles.yLabel}>10</span>
                <span className={styles.yLabel}>0</span>
              </div>
              <div className={styles.chartArea}>
                {chartData.map((point, index) => {
                  const height = (point.totalScore / 50) * 100;
                  const date = new Date(point.date);
                  const formattedDate = `${date.getDate()}.${date.getMonth() + 1}`;

                  return (
                    <div key={index} className={styles.chartBar}>
                      <div
                        className={`${styles.bar} ${getStressLevelColor(point.totalScore)}`}
                        style={{ height: `${height}%` }}
                        title={`${point.totalScore} баллов - ${formattedDate}`}
                      >
                        <span className={styles.barValue}>{point.totalScore}</span>
                      </div>
                      <span className={styles.barLabel}>{formattedDate}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.subscalesGrid}>
        <div className={styles.subscaleCard}>
          <h4 className={styles.subscaleTitle}>Перенапряжение</h4>
          <div className={styles.subscaleScore}>{stats.average_stress_score}</div>
          <div className={styles.subscaleMax}>из 30</div>
          <p className={styles.subscaleDescription}>
            Отражает степень переживания стрессовых ситуаций и чувство потери контроля
          </p>
        </div>

        <div className={styles.subscaleCard}>
          <h4 className={styles.subscaleTitle}>Противодействие стрессу</h4>
          <div className={styles.subscaleScore}>{stats.average_coping_score}</div>
          <div className={styles.subscaleMax}>из 20</div>
          <p className={styles.subscaleDescription}>
            Показывает вашу способность справляться со стрессом и контролировать ситуации
          </p>
        </div>
      </div>

      {stats.last_test_date && (
        <div className={styles.lastTestInfo}>
          <span className={styles.lastTestLabel}>Последний тест:</span>
          <span className={styles.lastTestDate}>
            {new Date(stats.last_test_date).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      )}
      {/* AI Советы */}
      <AIAdvice
        userId={userId}
        totalScore={stats.average_total_score}
        stressScore={stats.average_stress_score}
        copingScore={stats.average_coping_score}
        stressLevel={
          stats.average_total_score <= 20 ? 'low' :
          stats.average_total_score <= 30 ? 'medium' :
          'high'
        }
        trend={stats.trend}
        testsCount={stats.tests_count}
      />


      <div className={styles.recommendations}>
        <h3 className={styles.recommendationsTitle}>
          <Brain size={20} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '0.5rem' }} />
          Рекомендации
        </h3>
        <ul className={styles.recommendationsList}>
          <li>Проходите тест регулярно (раз в неделю) для отслеживания динамики</li>
          <li>Обращайте внимание на тренды - они помогут вовремя заметить изменения</li>
          {stats.average_total_score > 30 && (
            <li className={styles.warningRecommendation}>
              При высоком уровне стресса рекомендуется обратиться к специалисту
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

