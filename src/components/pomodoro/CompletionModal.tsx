
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import styles from './CompletionModal.module.css';

interface CompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedCycles: number;
  totalTime: number;
}

export default function CompletionModal({
  isOpen,
  onClose,
  completedCycles,
  totalTime,
}: CompletionModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true);
      // Убираем конфетти через 3 секунды
      const timer = setTimeout(() => setShowConfetti(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Генерируем случайные конфетти
  const confettiColors = ['#0077ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  const confettiElements = showConfetti
    ? Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      }))
    : [];

  return (
    <div className={styles.modal} onClick={onClose}>
      {/* Конфетти */}
      {confettiElements.map((confetti) => (
        <div
          key={confetti.id}
          className={styles.confetti}
          style={{
            left: `${confetti.left}%`,
            backgroundColor: confetti.color,
            animationDelay: `${confetti.delay}s`,
          }}
        />
      ))}

      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Изображение котика */}
        <div className={styles.modalImage}>
          <Image
            src="/images/pomodoro/catBreak.jpg"
            alt="Поздравляем!"
            width={180}
            height={180}
            className={styles.catImage}
          />
        </div>

        {/* Заголовок */}
        <h2 className={styles.modalTitle}>
          Отличная работа!
        </h2>

        {/* Сообщение */}
        <p className={styles.modalMessage}>
          Вы успешно завершили все циклы Pomodoro! <br />
          Время отдохнуть и насладиться результатами.
        </p>

        {/* Статистика */}
        <div className={styles.modalStats}>
          <div className={styles.modalStatsRow}>
            <div className={styles.modalStatItem}>
              <div className={styles.modalStatValue}>{completedCycles}</div>
              <div className={styles.modalStatLabel}>Циклов</div>
            </div>
            <div className={styles.modalStatItem}>
              <div className={styles.modalStatValue}>{totalTime}</div>
              <div className={styles.modalStatLabel}>Минут фокуса</div>
            </div>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <button onClick={onClose} className={styles.modalButton}>
          <Sparkles size={20} />
          Супер! Продолжить
        </button>
      </div>
    </div>
  );
}

