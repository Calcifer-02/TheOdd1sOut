'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setAnswer, setCurrentQuestion, completeTest, resetTest, checkAndResetIfExpired } from '@/store/slices/moodSlice';
import { useMaxUser } from '@/hooks/useMaxUser';
import { saveMoodTestResult } from '@/services/moodTestService';
import AIAdvice from '@/components/mood/AIAdvice';
import styles from './mood.module.css';

interface Question {
    id: number;
  text: string;
  subscale: 'stress' | 'coping';
  reverse: boolean;
}

const questions: Question[] = [
  {
    id: 1,
    text: 'Как часто за последний месяц вы испытывали беспокойство из-за непредвиденных событий?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 2,
    text: 'Как часто за последний месяц Вам казалось сложным контролировать важные события Вашей жизни?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 3,
    text: 'Как часто за последний месяц Вы испытывали нервное напряжение или стресс?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 4,
    text: 'Как часто за последний месяц Вы чувствовали уверенность в том, что справитесь с решением ваших личных проблем?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 5,
    text: 'Как часто за последний месяц Вы чувствовали, что все идет так, как Вы этого хотели?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 6,
    text: 'Как часто за последний месяц Вы думали, что не можете справиться с тем, что вам нужно сделать?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 7,
    text: 'Как часто за последний месяц Вы были в состоянии справиться с вашей раздражительностью?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 8,
    text: 'Как часто за последний месяц Вы чувствовали, что владеете ситуацией?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 9,
    text: 'Как часто за последний месяц Вы чувствовали раздражение из-за того, что происходящие события выходили из-под вашего контроля?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 10,
    text: 'Как часто за последний месяц вам казалось, что накопившиеся трудности достигли такого предела, что Вы не могли их контролировать?',
    subscale: 'stress',
    reverse: false
  }
];

const options = [
  { value: 1, label: 'Никогда' },
  { value: 2, label: 'Почти никогда' },
  { value: 3, label: 'Иногда' },
  { value: 4, label: 'Довольно часто' },
  { value: 5, label: 'Часто' }
];

export default function MoodPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useMaxUser();

  // Получаем состояние из Redux
  const moodState = useAppSelector((state) => state.mood);
  const { currentQuestion, answers, isComplete, result } = moodState;

  // Локальное состояние для согласия на обработку данных
  const [hasConsent, setHasConsent] = useState(false);
  const [showConsentScreen, setShowConsentScreen] = useState(true);

  // Проверяем на истечение срока при загрузке компонента
  useEffect(() => {
    dispatch(checkAndResetIfExpired());

    // Если тест уже начат (есть ответы), пропускаем экран согласия
    if (Object.keys(answers).length > 0 || isComplete) {
      setShowConsentScreen(false);
      setHasConsent(true);
    }
  }, [dispatch, answers, isComplete]);

  const handleAnswerSelect = (questionId: number, value: number) => {
    dispatch(setAnswer({ questionId, value }));
  };

  const calculateScores = () => {
    let stressScore = 0;
    let copingScore = 0;

    questions.forEach(question => {
      const answer = answers[question.id] || 0;

      if (question.subscale === 'stress') {
        stressScore += answer;
      } else {
        // Для субшкалы "Противодействие стрессу" инвертируем баллы
        const invertedScore = 6 - answer;
        copingScore += invertedScore;
      }
    });

    const totalScore = stressScore + copingScore;

    return { stressScore, copingScore, totalScore };
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      dispatch(setCurrentQuestion(currentQuestion + 1));
    } else {
      // Завершаем тест и сохраняем результаты
      const scores = calculateScores();
      dispatch(completeTest(scores));

      // Сохраняем результаты в БД, если пользователь авторизован
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
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      dispatch(setCurrentQuestion(currentQuestion - 1));
    }
  };

  const handlePause = () => {
    // Просто возвращаемся на главную, состояние сохранено в Redux
    router.push('/');
  };

  const handleRetake = () => {
    dispatch(resetTest());
  };

  const getStressLevel = (score: number): { level: string; color: string; interpretation: string } => {
    if (score <= 20) {
      return {
        level: 'Низкий уровень стресса',
        color: 'scoreLow',
        interpretation: 'Ваш уровень воспринимаемого стресса находится в пределах нормы. Вы хорошо справляетесь с повседневными ситуациями и эффективно контролируете свои эмоции. Продолжайте поддерживать здоровый баланс между работой и отдыхом.'
      };
    } else if (score <= 30) {
      return {
        level: 'Умеренный уровень стресса',
        color: 'scoreMedium',
        interpretation: 'Вы испытываете умеренный уровень стресса. Это нормальная реакция на жизненные обстоятельства, однако стоит обратить внимание на методы управления стрессом. Рекомендуется практиковать техники релаксации, регулярные физические упражнения и достаточный сон.'
      };
    } else {
      return {
        level: 'Высокий уровень стресса',
        color: 'scoreHigh',
        interpretation: 'Ваш уровень воспринимаемого стресса выше нормы. Это может негативно влиять на ваше физическое и психологическое здоровье. Рекомендуется обратиться к специалисту (психологу или психотерапевту) для получения профессиональной поддержки. Важно уделить внимание методам снижения стресса и самоподдержке.'
      };
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const currentQ = questions[currentQuestion];
  const hasAnswer = answers[currentQ?.id] !== undefined;

  // Экран согласия на обработку данных
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
            <button
              className={`${styles.button} ${styles.buttonSecondary}`}
              onClick={() => router.push('/')}
            >
              Отмена
            </button>
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
    // Используем сохраненные результаты из Redux
    const { stressScore, copingScore, totalScore } = result || calculateScores();
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
          <span className={styles.progressText}>Вопрос {currentQuestion + 1} из {questions.length}</span>
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
          {options.map(option => (
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
            {currentQuestion === questions.length - 1 ? 'Завершить' : 'Далее'}
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

