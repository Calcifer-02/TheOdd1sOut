'use client';

import { useEffect, useState } from 'react';
import { Lightbulb, Loader2, AlertCircle } from 'lucide-react';
import styles from './AIAdvice.module.css';

interface Advice {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

interface AIAdviceProps {
  userId?: number;
  totalScore: number;
  stressScore: number;
  copingScore: number;
  stressLevel: 'low' | 'medium' | 'high';
  trend?: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  testsCount?: number;
}

export default function AIAdvice({
  userId,
  totalScore,
  stressScore,
  copingScore,
  stressLevel,
  trend,
  testsCount
}: AIAdviceProps) {
  const [advice, setAdvice] = useState<Advice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'ai' | 'fallback'>('fallback');
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);

  useEffect(() => {
    fetchAdvice();
  }, [totalScore, stressScore, copingScore, stressLevel, trend, testsCount]);

  const fetchAdvice = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          totalScore,
          stressScore,
          copingScore,
          stressLevel,
          trend,
          testsCount
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch advice');
      }

      const data = await response.json();
      setAdvice(data.advice || []);
      setSource(data.source || 'fallback');
      setCached(data.cached || false);
      setCachedAt(data.cachedAt || null);
    } catch (err) {
      console.error('Error fetching AI advice:', err);
      setError('Не удалось загрузить рекомендации');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return styles.priorityHigh;
      case 'medium':
        return styles.priorityMedium;
      case 'low':
        return styles.priorityLow;
      default:
        return '';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'Важно';
      case 'medium':
        return 'Рекомендуется';
      case 'low':
        return 'Совет';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Lightbulb size={24} className={styles.icon} />
          <h3 className={styles.title}>Персональные рекомендации</h3>
        </div>
        <div className={styles.loading}>
          <Loader2 size={32} className={styles.spinner} />
          <p>Генерируем рекомендации на основе ваших результатов...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <Lightbulb size={24} className={styles.icon} />
          <h3 className={styles.title}>Персональные рекомендации</h3>
        </div>
        <div className={styles.error}>
          <AlertCircle size={24} />
          <p>{error}</p>
          <button onClick={fetchAdvice} className={styles.retryButton}>
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Lightbulb size={24} className={styles.icon} />
        <h3 className={styles.title}>Персональные рекомендации</h3>
        {source === 'ai' && (
          <span className={styles.aiBadge}>
            AI
          </span>
        )}
        {cached && cachedAt && (
          <span className={styles.cachedBadge} title={`Обновлено: ${new Date(cachedAt).toLocaleDateString('ru-RU')}`}>
            📅
          </span>
        )}
      </div>

      <div className={styles.adviceList}>
        {advice.map((item, index) => (
          <div key={index} className={`${styles.adviceCard} ${getPriorityColor(item.priority)}`}>
            <div className={styles.adviceHeader}>
              <span className={styles.priorityBadge}>
                {getPriorityLabel(item.priority)}
              </span>
              <h4 className={styles.adviceTitle}>{item.title}</h4>
            </div>
            <p className={styles.adviceDescription}>{item.description}</p>
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <p className={styles.disclaimer}>
          💡 Рекомендации носят информационный характер и не заменяют консультацию специалиста
        </p>
      </div>
    </div>
  );
}

