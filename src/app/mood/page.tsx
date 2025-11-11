'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Brain, BarChart3, Lightbulb, TrendingUp, Clock } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setAnswer, setCurrentQuestion, completeTest, resetTest, checkAndResetIfExpired } from '@/store/slices/moodSlice';
import { useMaxUser } from '@/hooks/useMaxUser';
import { saveMoodTestResult } from '@/services/moodTestService';
import AIAdvice from '@/components/mood/AIAdvice';
import { QUESTIONS, OPTIONS } from '@/shared/constants/moodTest';
import { calculateScores, getStressLevel } from '@/utils/moodTest';
import styles from './mood.module.css';

export default function MoodPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useMaxUser();
  const moodState = useAppSelector((state) => state.mood);
  const { currentQuestion, answers, isComplete, result } = moodState;
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentScreen, setShowConsentScreen] = useState(false);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(true);
  const [hasInProgressTest, setHasInProgressTest] = useState(false);
  useEffect(() => {
    dispatch(checkAndResetIfExpired());

    // Проверяем, есть ли тест в процессе
    const inProgress = Object.keys(answers).length > 0 && !isComplete;
    setHasInProgressTest(inProgress);

    // Если тест завершён, показываем результаты
    if (isComplete) {
      setShowWelcomeScreen(false);
      setShowConsentScreen(false);
    }
  }, [dispatch, answers, isComplete]);

  // Мемоизируем текущий вопрос
  const currentQ = useMemo(() => QUESTIONS[currentQuestion], [currentQuestion]);

  // Мемоизируем проверку наличия ответа
  const hasAnswer = useMemo(() => answers[currentQ?.id] !== undefined, [answers, currentQ]);

  // Мемоизируем прогресс
  const progress = useMemo(() => ((currentQuestion + 1) / QUESTIONS.length) * 100, [currentQuestion]);

  const handleAnswerSelect = useCallback((questionId: number, value: number) => {
    dispatch(setAnswer({ questionId, value }));
  }, [dispatch]);

  const handleNext = useCallback(() => {
    if (currentQuestion < QUESTIONS.length - 1) {
      dispatch(setCurrentQuestion(currentQuestion + 1));
    } else {

      const scores = calculateScores(QUESTIONS, answers);
      dispatch(completeTest(scores));

      if (user?.user_id) {
        const stressLevel =
          scores.totalScore <= 20 ? 'low' :
          scores.totalScore <= 30 ? 'medium' :
          'high';

        saveMoodTestResult({
          user_id: user.user_id,
          test_type: 'PSS',
          total_score: scores.totalScore,
          stress_score: scores.stressScore,
          coping_score: scores.copingScore,
          stress_level: stressLevel,
          answers: answers,
          completed_at: new Date().toISOString()
        }).catch(error => {
          console.error('Failed to save test result:', error);
        });
      }
    }
  }, [currentQuestion, answers, dispatch, user]);

  const handlePrevious = useCallback(() => {
    if (currentQuestion > 0) {
      dispatch(setCurrentQuestion(currentQuestion - 1));
    }
  }, [currentQuestion, dispatch]);

  const handlePause = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleRetake = useCallback(() => {
    dispatch(resetTest());
  }, [dispatch]);

  const handleStartNewTest = useCallback(() => {
    dispatch(resetTest());
    setShowWelcomeScreen(false);
    setShowConsentScreen(true);
    setHasInProgressTest(false);
  }, [dispatch]);

  const handleContinueTest = useCallback(() => {
    setShowWelcomeScreen(false);
    setShowConsentScreen(false);
  }, []);


  if (showWelcomeScreen) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Тест психологического состояния</h1>
          <p className={styles.subtitle}>
            Шкала воспринимаемого стресса (Perceived Stress Scale)
          </p>
        </div>

        <div className={styles.welcomeCard}>
          <div className={styles.welcomeIcon}>
            <Brain size={64} strokeWidth={1.5} />
          </div>

          <h2 className={styles.welcomeTitle}>
            Добро пожаловать!
          </h2>

          <p className={styles.welcomeText}>
            Этот тест поможет вам оценить уровень стресса за последний месяц.
            Он состоит из 10 вопросов и займёт около 3-5 минут.
          </p>

          <div className={styles.welcomeFeatures}>
            <div className={styles.featureItem}>
              <BarChart3 size={32} className={styles.featureIcon} />
              <span>Детальная аналитика</span>
            </div>
            <div className={styles.featureItem}>
              <Lightbulb size={32} className={styles.featureIcon} />
              <span>Персональные рекомендации</span>
            </div>
            <div className={styles.featureItem}>
              <TrendingUp size={32} className={styles.featureIcon} />
              <span>Отслеживание динамики</span>
            </div>
          </div>

          {hasInProgressTest && (
            <div className={styles.inProgressNotice}>
              <Clock size={24} className={styles.noticeIcon} />
              <p>У вас есть незавершённый тест. Вы можете продолжить с того места, где остановились.</p>
            </div>
          )}

          <div className={styles.welcomeActions}>
            {hasInProgressTest ? (
              <>
                <button
                  className={`${styles.button} ${styles.buttonPrimary}`}
                  onClick={handleContinueTest}
                >
                  Продолжить тест
                </button>
                <button
                  className={`${styles.button} ${styles.buttonSecondary}`}
                  onClick={handleStartNewTest}
                >
                  Начать заново
                </button>
              </>
            ) : (
              <button
                className={`${styles.button} ${styles.buttonPrimary}`}
                onClick={() => {
                  setShowWelcomeScreen(false);
                  setShowConsentScreen(true);
                }}
              >
                Начать тест
              </button>
            )}
            <Link href="/" className={`${styles.button} ${styles.buttonText}`}>
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    );
  }
  if (showConsentScreen) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Согласие на обработку данных</h1>
          <p className={styles.subtitle}>
            Перед прохождением теста PSS необходимо ваше согласие
          </p>
        </div>

        <div className={styles.consentCard}>
          <div className={styles.consentContent}>
            <h3 className={styles.consentTitle}>О тесте и ваших данных</h3>

            <p className={styles.consentText}>
              Шкала воспринимаемого стресса (Perceived Stress Scale, PSS) — это психологический тест,
              разработанный для оценки уровня стресса за последний месяц.
            </p>

            <p className={styles.consentText}>
              <strong>Что мы собираем:</strong>
            </p>
            <ul className={styles.consentList}>
              <li>Ваши ответы на 10 вопросов теста</li>
              <li>Результаты теста (баллы по субшкалам)</li>
              <li>Дату и время прохождения</li>
            </ul>

            <p className={styles.consentText}>
              <strong>Для чего используются данные:</strong>
            </p>
            <ul className={styles.consentList}>
              <li>Отслеживание динамики вашего психологического состояния</li>
              <li>Построение графиков и аналитики в вашем профиле</li>
              <li>Предоставление персонализированных рекомендаций</li>
            </ul>

            <p className={styles.consentText}>
              <strong>Ваши права:</strong>
            </p>
            <ul className={styles.consentList}>
              <li>Данные хранятся конфиденциально и не передаются третьим лицам</li>
              <li>Вы можете в любой момент удалить свои результаты</li>
              <li>Результаты видны только вам</li>
            </ul>

            <div className={styles.consentCheckbox}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={hasConsent}
                  onChange={(e) => setHasConsent(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>
                  Я ознакомлен(а) с информацией о сборе и обработке данных и даю согласие
                  на сохранение результатов теста для дальнейшего анализа
                </span>
              </label>
            </div>
          </div>

          <div className={styles.consentActions}>
            <Link
              href="/"
              className={`${styles.button} ${styles.buttonSecondary}`}
            >
              Отмена
            </Link>
            <button
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={() => setShowConsentScreen(false)}
              disabled={!hasConsent}
            >
              Начать тест
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isComplete) {
    const { stressScore, copingScore, totalScore } = result || calculateScores(QUESTIONS, answers);
    const { level, color, interpretation } = getStressLevel(totalScore);
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Результаты теста</h1>
          <p className={styles.subtitle}>
            Шкала воспринимаемого стресса (Perceived Stress Scale)
          </p>
        </div>

        <div className={styles.resultCard}>
          <h2 className={styles.resultTitle}>{level}</h2>

          <div className={styles.scoreDisplay}>
            <div className={`${styles.scoreCircle} ${styles[color]}`}>
              <div>{totalScore}</div>
              <div className={styles.scoreLabel}>из 50</div>
            </div>
          </div>

          <div className={styles.subscalesContainer}>
            <div className={styles.subscaleCard}>
              <div className={styles.subscaleTitle}>Перенапряжение</div>
              <div className={styles.subscaleScore}>{stressScore}</div>
              <div className={styles.subscaleMax}>из 30</div>
            </div>
            <div className={styles.subscaleCard}>
              <div className={styles.subscaleTitle}>Противодействие стрессу</div>
              <div className={styles.subscaleScore}>{copingScore}</div>
              <div className={styles.subscaleMax}>из 20</div>
            </div>
          </div>

          <div className={styles.interpretation}>
            <h3 className={styles.interpretationTitle}>Интерпретация результатов</h3>
            <p className={styles.interpretationText}>{interpretation}</p>
            <p className={styles.interpretationText}>
              <strong>Субшкала "Перенапряжение" ({stressScore} баллов):</strong> Отражает степень переживания стрессовых ситуаций, чувство потери контроля и накопления трудностей.
            </p>
            <p className={styles.interpretationText}>
              <strong>Субшкала "Противодействие стрессу" ({copingScore} баллов):</strong> Показывает вашу способность справляться со стрессом и контролировать жизненные ситуации.
            </p>
          </div>
          {/* AI Советы */}
          <AIAdvice
            userId={user?.user_id}
            totalScore={totalScore}
            stressScore={stressScore}
            copingScore={copingScore}
            stressLevel={totalScore <= 20 ? 'low' : totalScore <= 30 ? 'medium' : 'high'}
          />


          <div className={styles.actions}>
            <button
              className={`${styles.actionButton} ${styles.retakeButton}`}
              onClick={handleRetake}
            >
              Пройти тест заново
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Тест психологического состояния</h1>
        <p className={styles.subtitle}>
          Шкала воспринимаемого стресса (Perceived Stress Scale, PSS) помогает оценить уровень стресса за последний месяц.
          Ответьте на 10 вопросов, выбрав наиболее подходящий вариант. Проходите тест каждую неделю, чтобы отслеживать изменения в вашем состоянии.
        </p>
      </div>

      <div className={styles.testCard}>
        <div className={styles.progress}>
          <span className={styles.progressText}>Вопрос {currentQuestion + 1} из {QUESTIONS.length}</span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className={styles.progressText}>{Math.round(progress)}%</span>
        </div>

        <h2 className={styles.questionText}>
          {currentQ.text}
        </h2>

        <div className={styles.options}>
          {OPTIONS.map(option => (
            <div
              key={option.value}
              className={`${styles.option} ${
                answers[currentQ.id] === option.value ? styles.selected : ''
              }`}
              onClick={() => handleAnswerSelect(currentQ.id, option.value)}
            >
              <div className={styles.radioButton} />
              <span className={styles.optionText}>{option.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.navigation}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
          >
            Назад
          </button>
          <button
            className={`${styles.button} ${styles.buttonPrimary}`}
            onClick={handleNext}
            disabled={!hasAnswer}
          >
            {currentQuestion === QUESTIONS.length - 1 ? 'Завершить' : 'Далее'}
          </button>
        </div>

        <button
          className={`${styles.button} ${styles.pauseButton}`}
          onClick={handlePause}
        >
          Приостановить тест
        </button>
      </div>
    </div>
  );
}

