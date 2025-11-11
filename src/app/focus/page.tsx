'use client';

import { useState, useEffect, useRef } from 'react';
import { Target, Settings } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setFocusMinutes,
  setBreakMinutes,
  setCycles,
  decrementTime,
  startTimer,
  pauseTimer,
  resetTimer,
  completeTimer,
} from '@/store/slices/pomodoroSlice';
import PomodoroSettings from '@/components/pomodoro/PomodoroSettings';
import PomodoroTimer from '@/components/pomodoro/PomodoroTimer';
import PomodoroStats from '@/components/pomodoro/PomodoroStats';
import CompletionModal from '@/components/pomodoro/CompletionModal';
import styles from './focus.module.css';

export default function FocusPage() {
  const dispatch = useAppDispatch();

  // Получаем состояние из Redux
  const {
    settings: { focusMinutes, breakMinutes, cycles },
    mode,
    timeLeft,
    isRunning,
    currentCycle,
    completedCycles,
  } = useAppSelector((state) => state.pomodoro);

  const [showSettings, setShowSettings] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Таймер
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        dispatch(decrementTime());
      }, 1000);
    } else if (timeLeft === 0 && isRunning) {
      dispatch(completeTimer());

      // Показываем модалку при завершении всех циклов
      if (mode === 'focus' && currentCycle >= cycles) {
        setShowCompletionModal(true);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, timeLeft, dispatch, mode, currentCycle, cycles]);

  const progress = mode === 'focus'
    ? ((focusMinutes * 60 - timeLeft) / (focusMinutes * 60)) * 100
    : ((breakMinutes * 60 - timeLeft) / (breakMinutes * 60)) * 100;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Target className={styles.titleIcon} size={28} />
          Pomodoro Фокус
        </h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className={styles.settingsButton}
        >
          <Settings size={18} />
          Настройки
        </button>
      </div>

      {/* Настройки */}
      {showSettings && (
        <PomodoroSettings
          focusMinutes={focusMinutes}
          breakMinutes={breakMinutes}
          cycles={cycles}
          onFocusChange={(value) => dispatch(setFocusMinutes(value))}
          onBreakChange={(value) => dispatch(setBreakMinutes(value))}
          onCyclesChange={(value) => dispatch(setCycles(value))}
          disabled={mode !== 'idle'}
        />
      )}

      {/* Таймер */}
      <PomodoroTimer
        mode={mode}
        timeLeft={timeLeft}
        isRunning={isRunning}
        currentCycle={currentCycle}
        cycles={cycles}
        progress={progress}
        onStart={() => dispatch(startTimer())}
        onPause={() => dispatch(pauseTimer())}
        onReset={() => dispatch(resetTimer())}
      />

      {/* Статистика */}
      <PomodoroStats
        completedCycles={completedCycles}
        currentCycle={currentCycle}
        totalCycles={cycles}
      />

      {/* Модалка завершения */}
      <CompletionModal
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
        completedCycles={completedCycles}
        totalTime={completedCycles * focusMinutes}
      />
    </div>
  );
}

