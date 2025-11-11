import { Question } from '@/shared/constants/moodTest';

export interface StressLevelResult {
  level: string;
  color: string;
  interpretation: string;
}

export interface TestScores {
  stressScore: number;
  copingScore: number;
  totalScore: number;
}

export const calculateScores = (
  questions: Question[],
  answers: { [key: number]: number }
): TestScores => {
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

export const getStressLevel = (score: number): StressLevelResult => {
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

