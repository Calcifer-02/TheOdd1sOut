import { NextRequest, NextResponse } from 'next/server';
import Perplexity from '@perplexity-ai/perplexity_ai';
import { createClient } from '@supabase/supabase-js';

interface AdviceRequest {
  userId?: number;
  totalScore: number;
  stressScore: number;
  copingScore: number;
  stressLevel: 'low' | 'medium' | 'high';
  trend?: 'improving' | 'stable' | 'worsening' | 'insufficient_data';
  testsCount?: number;
}

interface AdviceResponse {
  advice: {
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const data: AdviceRequest = await request.json();

    console.log('[AI Advice] Generating advice for:', data);

    // Проверяем кеш, если передан userId
    if (data.userId) {
      const cachedAdvice = await getCachedAdvice(data);
      if (cachedAdvice) {
        console.log('[AI Advice] Returning cached advice');
        return NextResponse.json({
          advice: cachedAdvice.advice,
          source: cachedAdvice.source,
          cached: true,
          cachedAt: cachedAdvice.created_at
        });
      }
    }

    // Проверяем наличие API ключа
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.error('[AI Advice] PERPLEXITY_API_KEY not found');
      const fallbackAdvice = getFallbackAdvice(data);

      // Сохраняем fallback в кеш
      if (data.userId) {
        await saveCachedAdvice(data, fallbackAdvice, 'fallback');
      }

      return NextResponse.json({
        advice: fallbackAdvice,
        source: 'fallback',
        cached: false
      });
    }

    const client = new Perplexity({ apiKey });
    const prompt = buildPrompt(data);

    const completion = await client.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `Ты - психолог-аналитик, специализирующийся на долгосрочном управлении стрессом. 

Твоя задача - анализировать динамику психологического состояния пользователя и давать стратегические рекомендации на основе тенденций, а не экстренные советы "здесь и сейчас".

Правила:
- Фокусируйся на долгосрочных изменениях образа жизни, а не на быстрых техниках
- Анализируй тренды: если состояние ухудшается - ищи причины, если улучшается - подскажи как закрепить результат
- Советы должны быть про изменение привычек, паттернов поведения, окружения
- НЕ советуй "сделай дыхательное упражнение прямо сейчас" - это не стратегический подход
- Учитывай количество тестов: если тестов мало - дай совет про регулярность мониторинга
- Будь конкретным: не "займитесь спортом", а "выделите 3 дня в неделю по 30 минут для прогулок"

Ответы на русском языке, краткие и практичные.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'sonar-pro',
      response_format: {
        type: 'json_schema',
        json_schema: {
          schema: {
            type: 'object',
            properties: {
              advice: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Краткий заголовок совета (до 50 символов)'
                    },
                    description: {
                      type: 'string',
                      description: 'Подробное описание совета (до 200 символов)'
                    },
                    priority: {
                      type: 'string',
                      enum: ['high', 'medium', 'low'],
                      description: 'Приоритет совета'
                    }
                  },
                  required: ['title', 'description', 'priority']
                },
                minItems: 1,
                maxItems: 3
              }
            },
            required: ['advice']
          }
        }
      }
    });

    const messageContent = completion.choices[0].message.content;
    const contentString = typeof messageContent === 'string'
      ? messageContent
      : JSON.stringify(messageContent);

    const result = JSON.parse(contentString || '{}') as AdviceResponse;

    console.log('[AI Advice] Generated advice:', result);

    // Сохраняем в кеш, если есть userId
    if (data.userId && result.advice) {
      await saveCachedAdvice(data, result.advice, 'ai');
    }

    return NextResponse.json({
      ...result,
      source: 'ai',
      cached: false
    });

  } catch (error) {
    console.error('[AI Advice] Error generating advice:', error);

    try {
      const data: AdviceRequest = await request.json();
      return NextResponse.json({
        advice: getFallbackAdvice(data),
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch {
      return NextResponse.json({
        advice: getFallbackAdvice({
          totalScore: 25,
          stressScore: 15,
          copingScore: 10,
          stressLevel: 'medium'
        }),
        source: 'fallback',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

function buildPrompt(data: AdviceRequest): string {
  const { totalScore, stressScore, copingScore, stressLevel, trend, testsCount } = data;

  const stressLevelText =
    stressLevel === 'low' ? 'низкий' :
    stressLevel === 'medium' ? 'умеренный' :
    'высокий';

  let trendText = '';
  if (trend === 'improving') trendText = 'Состояние улучшается.';
  else if (trend === 'worsening') trendText = 'Состояние ухудшается.';
  else if (trend === 'stable') trendText = 'Состояние стабильное.';

  const testsCountText = testsCount
    ? testsCount === 1
      ? 'Это первый тест пользователя - нет истории для анализа динамики.'
      : `Пользователь прошёл ${testsCount} тестов - есть история для анализа.`
    : 'Нет данных о количестве тестов.';

  const analysisContext = trend === 'improving'
    ? 'Состояние УЛУЧШАЕТСЯ - пользователь что-то делает правильно. Помоги закрепить позитивные изменения.'
    : trend === 'worsening'
    ? 'Состояние УХУДШАЕТСЯ - нужно найти причины и предложить системные изменения.'
    : trend === 'stable'
    ? 'Состояние СТАБИЛЬНОЕ - помоги оптимизировать текущий подход.'
    : 'Недостаточно данных для анализа динамики - дай совет про регулярный мониторинг.';

  return `Анализ результатов теста PSS (Perceived Stress Scale):

ТЕКУЩЕЕ СОСТОЯНИЕ:
- Общий балл стресса: ${totalScore}/50 (${stressLevelText} уровень)
- Перенапряжение: ${stressScore}/30 ${stressScore > 20 ? '⚠️ высокий показатель' : ''}
- Ресурсы противодействия: ${copingScore}/20 ${copingScore < 10 ? '⚠️ низкий показатель' : ''}

ДИНАМИКА: ${trendText} ${analysisContext}

ИСТОРИЯ: ${testsCountText}

ЗАДАЧА: Проанализируй ситуацию и дай 2-3 СТРАТЕГИЧЕСКИХ совета для долгосрочного управления стрессом:

1. ${trend === 'worsening' ? 'СИСТЕМНЫЙ АНАЛИЗ: Что может быть причиной ухудшения? Какие изменения в жизни нужны?' : trend === 'improving' ? 'ЗАКРЕПЛЕНИЕ: Как поддержать позитивную динамику? Что продолжать делать?' : 'ГЛАВНОЕ НАПРАВЛЕНИЕ: На чём сфокусироваться для улучшения состояния?'}

2. КОНКРЕТНЫЕ ДЕЙСТВИЯ: Какие привычки внедрить в жизнь? (с конкретикой: когда, как часто, сколько времени)

3. ${testsCount && testsCount < 3 ? 'МОНИТОРИНГ: Как отслеживать прогресс?' : 'ДОЛГОСРОЧНАЯ СТРАТЕГИЯ: Что делать в ближайшие 1-3 месяца?'}

ТРЕБОВАНИЯ:
- Заголовок: до 50 символов, ёмкий
- Описание: до 200 символов, конкретное и применимое
- Приоритет: high только для критических вещей, остальное medium/low
- НЕ советуй "сделай дыхательное упражнение сейчас" - только про изменение образа жизни
- Учитывай динамику и контекст, а не только текущий балл`;
}

function getFallbackAdvice(data: AdviceRequest): AdviceResponse['advice'] {
  const { stressLevel, trend } = data;

  if (stressLevel === 'high') {
    const advice: AdviceResponse['advice'] = [];

    if (trend === 'worsening') {
      advice.push({
        title: 'Пересмотрите рабочую нагрузку',
        description: 'Состояние ухудшает��я. Проанализируйте: что изменилось за последний месяц? Возможно, нужно обсудить с руководством снижение нагрузки или взять отпуск.',
        priority: 'high'
      });
    } else if (trend === 'improving') {
      advice.push({
        title: 'Закрепите позитивные изменения',
        description: 'Ваше состояние улучшается - это отличный знак! Определите, какие действия помогают, и превратите их в постоянные привычки.',
        priority: 'medium'
      });
    } else {
      advice.push({
        title: 'Проконсультируйтесь со специалистом',
        description: 'При высоком стрессе рекомендуется работа с психологом для поиска источников напряжения и разработки индивидуальной стратегии.',
        priority: 'high'
      });
    }

    advice.push({
      title: 'Внедрите ежедневную активность',
      description: 'Выделите 30-40 минут каждый день (утром или после работы) для прогулок, пробежек или спортзала. Начните с 3 раз в неделю, постепенно увеличивая.',
      priority: 'high'
    });

    advice.push({
      title: 'Установите четкие границы',
      description: 'Определите часы работы и личного времени. Отключайте рабочие уведомления после 20:00. Научитесь отказывать без чувства вины.',
      priority: 'medium'
    });

    return advice.slice(0, 3);
  } else if (stressLevel === 'medium') {
    const advice: AdviceResponse['advice'] = [];

    if (trend === 'improving') {
      advice.push({
        title: 'Продолжайте в том же духе',
        description: 'Стресс снижается - ваша стратегия работает. Запишите, что именно помогает, чтобы не потерять эффективные привычки при изменении обстоятельств.',
        priority: 'medium'
      });
    } else if (trend === 'worsening') {
      advice.push({
        title: 'Найдите источник напряжения',
        description: 'Стресс растёт. Проведите недельный дневник стресса: когда и от чего вы напрягаетесь больше всего? Это поможет выявить паттерны.',
        priority: 'high'
      });
    } else {
      advice.push({
        title: 'Оптимизируйте режим сна',
        description: 'Ложитесь и вставайте в одно время каждый день (даже в выходные). За час до сна - никаких экранов. Проветривайте спальню.',
        priority: 'high'
      });
    }

    advice.push({
      title: 'Регулярный мониторинг состояния',
      description: 'Проходите этот тест каждую неделю в один и тот же день. Это поможет отследить, что влияет на ваш уровень стресса.',
      priority: 'medium'
    });

    return advice;
  } else {
    return [
      {
        title: 'Поддерживайте профилактику',
        description: 'Стресс в норме - отлично! Сохраняйте баланс работы и отдыха, не перегружайте себя новыми обязательствами без необходимости.',
        priority: 'low'
      },
      {
        title: 'Отслеживайте динамику',
        description: 'Проходите тест раз в 1-2 недели, чтобы заметить изменения на ранней стадии. Низкий стресс сегодня не гарантирует его завтра.',
        priority: 'low'
      }
    ];
  }
}

// ============================================================================
// Функции для работы с кешем
// ============================================================================

async function getCachedAdvice(data: AdviceRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey || !data.userId) {
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: cached, error } = await supabase
      .from('ai_advice_cache')
      .select('*')
      .eq('user_id', data.userId)
      .eq('stress_level', data.stressLevel)
      .eq('trend', data.trend || null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !cached) {
      console.log('[AI Advice] No valid cache found');
      return null;
    }

    const scoreDiff = Math.abs(cached.total_score - data.totalScore);
    if (scoreDiff > 5) {
      console.log('[AI Advice] Score changed significantly, invalidating cache');
      return null;
    }

    console.log('[AI Advice] Found valid cache from', cached.created_at);
    return cached;
  } catch (error) {
    console.error('[AI Advice] Error checking cache:', error);
    return null;
  }
}

async function saveCachedAdvice(
  data: AdviceRequest,
  advice: AdviceResponse['advice'],
  source: 'ai' | 'fallback'
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey || !data.userId) {
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase
      .from('ai_advice_cache')
      .delete()
      .eq('user_id', data.userId)
      .eq('stress_level', data.stressLevel)
      .eq('trend', data.trend || null);

    const { error } = await supabase
      .from('ai_advice_cache')
      .insert({
        user_id: data.userId,
        total_score: data.totalScore,
        stress_score: data.stressScore,
        coping_score: data.copingScore,
        stress_level: data.stressLevel,
        trend: data.trend || null,
        advice: advice as any,
        source: source
      });

    if (error) {
      console.error('[AI Advice] Error saving cache:', error);
    } else {
      console.log('[AI Advice] Cache saved successfully');
    }
  } catch (error) {
    console.error('[AI Advice] Error saving cache:', error);
  }
}

