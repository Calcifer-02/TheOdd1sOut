import { Target, Repeat, TrendingUp } from 'lucide-react';
import styles from './PomodoroStats.module.css';

interface PomodoroStatsProps {
  completedCycles: number;
  currentCycle: number;
  totalCycles: number;
}

export default function PomodoroStats({
  completedCycles,
  currentCycle,
  totalCycles,
}: PomodoroStatsProps) {
  return (
    <div className={styles.stats}>
      <h3 className={styles.statsTitle}>
        <TrendingUp size={20} className={styles.statsTitleIcon} />
        Статистика сессии
      </h3>
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <Target size={32} strokeWidth={2} />
          </div>
          <div className={`${styles.statValue} ${styles.statValuePrimary}`}>
            {completedCycles}
          </div>
          <div className={styles.statLabel}>
            Завершено циклов
          </div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statIcon}>
            <Repeat size={32} strokeWidth={2} />
          </div>
          <div className={`${styles.statValue} ${styles.statValueSuccess}`}>
            {currentCycle}/{totalCycles}
          </div>
          <div className={styles.statLabel}>
            Текущий цикл
          </div>
        </div>
      </div>
    </div>
  );
}

