import { NextRequest, NextResponse } from 'next/server';
import Perplexity from '@perplexity-ai/perplexity_ai';

// POST /api/ai/parse-task - парсинг голосовой команды через AI
export async function POST(request: NextRequest) {
    try {
        const { speechText } = await request.json();

        if (!speechText || typeof speechText !== 'string') {
            return NextResponse.json(
                { error: 'speechText is required' },
                { status: 400 }
            );
        }

        // Проверяем API ключ
        const apiKey = process.env.PERPLEXITY_API_KEY;
        if (!apiKey) {
            console.error('PERPLEXITY_API_KEY not found in environment');
            return NextResponse.json(
                { error: 'AI service not configured' },
                { status: 503 }
            );
        }

        // Создаем клиент Perplexity
        const client = new Perplexity({ apiKey });

        // Делаем запрос к AI
        const completion = await client.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Ты - помощник для разбора голосовых команд создания задач на русском языке. 
Извлеки из текста:
- title (название задачи, обязательно)
- description (дополнительное описание, если есть)
- priority (низкий/средний/высокий - определи по контексту или ключевым словам: "срочно"/"важно"/"высокий" = high, "не срочно"/"низкий" = low, иначе medium)
- deadline (дата: "сегодня", "завтра", конкретная дата, или undefined)
- time (время если указано: "до обеда"="12:00", "вечером"="18:00", "утром"="09:00", или точное время)
- assignee (исполнитель: "Я", "Александр", "Команда" - если упомянут, иначе "Я")
- tags (метки: "личное", "работа", "срочно" - определи по контексту)

Сегодня ${new Date().toLocaleDateString('ru-RU')}.`,
                },
                {
                    role: 'user',
                    content: speechText,
                },
            ],
            model: 'sonar-pro',
            response_format: {
                type: 'json_schema',
                json_schema: {
                    schema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            description: { type: 'string' },
                            priority: {
                                type: 'string',
                                enum: ['low', 'medium', 'high']
                            },
                            deadline: { type: 'string' },
                            time: { type: 'string' },
                            assignee: { type: 'string' },
                            tags: {
                                type: 'array',
                                items: { type: 'string' }
                            }
                        },
                        required: ['title', 'priority']
                    }
                }
            }
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
            return NextResponse.json(
                { error: 'Empty response from AI' },
                { status: 500 }
            );
        }

        // content может быть строкой или массивом
        const contentString = typeof content === 'string' ? content : JSON.stringify(content);
        const parsed = JSON.parse(contentString);

        // Постобработка дат
        if (parsed.deadline) {
            parsed.deadline = normalizeDate(parsed.deadline);
        }

        console.log('✅ AI parsed task:', parsed);

        return NextResponse.json(parsed);
    } catch (error) {
        console.error('❌ AI parsing error:', error);
        return NextResponse.json(
            { error: 'Failed to parse task' },
            { status: 500 }
        );
    }
}

// Вспомогательная функция нормализации дат
function normalizeDate(dateStr: string): string {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lowerDate = dateStr.toLowerCase();

    if (lowerDate === 'сегодня' || lowerDate === 'today') {
        return today.toLocaleDateString('ru-RU');
    }
    if (lowerDate === 'завтра' || lowerDate === 'tomorrow') {
        return tomorrow.toLocaleDateString('ru-RU');
    }

    return dateStr;
}

