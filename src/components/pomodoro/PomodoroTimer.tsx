import Image from 'next/image';
import { Target, Coffee, Sparkles, Play, Pause, RotateCcw } from 'lucide-react';
import styles from './PomodoroTimer.module.css';

type TimerMode = 'focus' | 'break' | 'idle';

interface PomodoroTimerProps {
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  currentCycle: number;
  cycles: number;
  progress: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
}

export default function PomodoroTimer({
  mode,
  timeLeft,
  isRunning,
  currentCycle,
  cycles,
  progress,
  onStart,
  onPause,
  onReset,
}: PomodoroTimerProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`${styles.timerCard} ${
      mode === 'idle' ? styles.timerCardIdle : 
      mode === 'focus' ? styles.timerCardFocus : 
      styles.timerCardBreak
    }`}>
      {/* Изображение */}
      <div className={`${styles.imageContainer} ${isRunning ? styles.imageAnimated : ''}`}>
        <div className={styles.mascotImage}>
          {mode === 'break' && (
            <Image
              src="/images/pomodoro/catBreak.gif"
              alt="Котик на перерыве"
              width={230}
              height={230}
              className={styles.catImage}
            />
          )}
          {mode === 'focus' && isRunning && (
            <Image
              src="/images/pomodoro/catFocus.gif"
              alt="Котик работает"
              width={230}
              height={230}
              unoptimized
              className={styles.catImage}
            />
          )}
          {((mode === 'focus' && !isRunning) || mode === 'idle') && (
            <Image
              src="/images/pomodoro/catPause.gif"
              alt="Котик на паузе"
              width={230}
              height={230}
              unoptimized
              className={styles.catImage}
            />
          )}
        </div>
      </div>

      {/* Статус */}
      <div className={styles.status}>
        {mode === 'idle' && (
          <>
            <Sparkles size={24} className={styles.statusIcon} />
            Готовы начать?
          </>
        )}
        {mode === 'focus' && (
          <>
            <Target size={24} className={styles.statusIcon} />
            Время фокуса! ({currentCycle}/{cycles})
          </>
        )}
        {mode === 'break' && (
          <>
            <Coffee size={24} className={styles.statusIcon} />
            Время отдыха!
          </>
        )}
      </div>

      {/* Таймер */}
      <div className={styles.timerDisplay}>
        {formatTime(timeLeft)}
      </div>

      {/* Прогресс бар */}
      {mode !== 'idle' && (
        <div className={styles.progressBar}>
          <div
            className={`${styles.progressFill} ${
              mode === 'focus' ? styles.progressFillFocus : styles.progressFillBreak
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Кнопки управления */}
      <div className={styles.controls}>
        {!isRunning ? (
          <button
            onClick={onStart}
            className={`${styles.button} ${styles.buttonStart}`}
          >
            <Play size={20} />
            {mode === 'idle' ? 'Начать' : 'Продолжить'}
          </button>
        ) : (
          <button
            onClick={onPause}
            className={`${styles.button} ${styles.buttonPause}`}
          >
            <Pause size={20} />
            Пауза
          </button>
        )}

        <button
          onClick={onReset}
          className={`${styles.button} ${styles.buttonReset}`}
        >
          <RotateCcw size={20} />
          Сброс
        </button>
      </div>
    </div>
  );
}

