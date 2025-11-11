import { createClient } from '@supabase/supabase-js';

// Создаем клиент с service role key для обхода RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface MoodTestResult {
  id?: string;
  user_id: number;
  test_type: string;
  total_score: number;
  stress_score: number;
  coping_score: number;
  stress_level: 'low' | 'medium' | 'high';
  answers: { [key: number]: number };
  completed_at?: string;
  created_at?: string;
}

export interface MoodTestStats {
  average_total_score: number;
  average_stress_score: number;
  average_coping_score: number;
  tests_count: number;
  last_test_date: string | null;
  trend: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
}

/**
 * Сохранить результат теста в БД
 */
export async function saveMoodTestResult(result: MoodTestResult) {
  try {
    const { data, error } = await supabase
      .from('mood_test_results')
      .insert({
        user_id: result.user_id,
        test_type: result.test_type || 'PSS',
        total_score: result.total_score,
        stress_score: result.stress_score,
        coping_score: result.coping_score,
        stress_level: result.stress_level,
        answers: result.answers,
        completed_at: result.completed_at || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving mood test result:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Failed to save mood test result:', error);
    throw error;
  }
}

/**
 * Получить историю тестов пользователя
 */
export async function getMoodTestHistory(userId: number, limit: number = 10) {
  try {
    console.log('[moodTestService] Fetching history for user:', userId, 'limit:', limit);

    const { data, error } = await supabase
      .from('mood_test_results')
      .select('*')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[moodTestService] Error fetching mood test history:', error);
      console.error('[moodTestService] Error details:', JSON.stringify(error, null, 2));
      throw error;
    }

    console.log('[moodTestService] Fetched data:', data?.length || 0, 'records');
    return data || [];
  } catch (error) {
    console.error('[moodTestService] Failed to fetch mood test history:', error);
    return [];
  }
}

/**
 * Получить статистику тестов пользователя
 */
export async function getMoodTestStats(userId: number): Promise<MoodTestStats> {
  try {
    console.log('[moodTestService] Getting stats for user:', userId);
    const history = await getMoodTestHistory(userId, 100);

    console.log('[moodTestService] History length:', history.length);
    if (history.length > 0) {
      console.log('[moodTestService] Sample record:', history[0]);
    }

    if (history.length === 0) {
      console.warn('[moodTestService] No history found, returning empty stats');
      return {
        average_total_score: 0,
        average_stress_score: 0,
        average_coping_score: 0,
        tests_count: 0,
        last_test_date: null,
        trend: 'insufficient_data'
      };
    }

    // Вычисляем средние значения
    const totalScoreSum = history.reduce((sum, test) => sum + test.total_score, 0);
    const stressScoreSum = history.reduce((sum, test) => sum + test.stress_score, 0);
    const copingScoreSum = history.reduce((sum, test) => sum + test.coping_score, 0);

    const stats: MoodTestStats = {
      average_total_score: Math.round(totalScoreSum / history.length),
      average_stress_score: Math.round(stressScoreSum / history.length),
      average_coping_score: Math.round(copingScoreSum / history.length),
      tests_count: history.length,
      last_test_date: history[0]?.completed_at || null,
      trend: 'stable'
    };

    console.log('[moodTestService] Calculated stats:', stats);

    // Определяем тренд (сравниваем последние 3 теста с предыдущими 3)
    if (history.length >= 6) {
      const recentTests = history.slice(0, 3);
      const olderTests = history.slice(3, 6);

      const recentAvg = recentTests.reduce((sum, test) => sum + test.total_score, 0) / 3;
      const olderAvg = olderTests.reduce((sum, test) => sum + test.total_score, 0) / 3;

      const diff = recentAvg - olderAvg;

      if (diff < -3) {
        stats.trend = 'improving'; // Балл уменьшается = состояние улучшается
      } else if (diff > 3) {
        stats.trend = 'worsening'; // Балл увеличивается = состояние ухудшается
      } else {
        stats.trend = 'stable';
      }
    } else if (history.length >= 2) {
      // Если тестов меньше, просто сравниваем последний с предпоследним
      const diff = history[0].total_score - history[1].total_score;
      if (diff < -3) {
        stats.trend = 'improving';
      } else if (diff > 3) {
        stats.trend = 'worsening';
      } else {
        stats.trend = 'stable';
      }
    }

    console.log('[moodTestService] Final stats with trend:', stats);
    return stats;
  } catch (error) {
    console.error('[moodTestService] Failed to calculate mood test stats:', error);
    return {
      average_total_score: 0,
      average_stress_score: 0,
      average_coping_score: 0,
      tests_count: 0,
      last_test_date: null,
      trend: 'insufficient_data'
    };
  }
}

/**
 * Получить данные для графика (последние N тестов)
 */
export async function getMoodTestChartData(userId: number, limit: number = 30) {
  try {
    const history = await getMoodTestHistory(userId, limit);

    // Возвращаем в обратном порядке (от старых к новым) для графика
    return history.reverse().map(test => ({
      date: test.completed_at,
      totalScore: test.total_score,
      stressScore: test.stress_score,
      copingScore: test.coping_score,
      level: test.stress_level
    }));
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    return [];
  }
}

