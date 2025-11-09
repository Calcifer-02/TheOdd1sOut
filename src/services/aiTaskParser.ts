export interface ParsedTask {
    title: string;
    description?: string;
    priority: 'low' | 'medium' | 'high';
    deadline?: string; // Дата в формате "DD.MM.YYYY"
    time?: string; // Время в формате "HH:MM"
    assignee?: string;
    tags?: string[];
}

export class AITaskParser {
    async parseTaskFromSpeech(speechText: string): Promise<ParsedTask> {
        try {
            // Вызываем наш backend API endpoint
            const response = await fetch('/api/ai/parse-task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ speechText }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to parse task');
            }

            const parsed: ParsedTask = await response.json();
            console.log('✅ AI parsed:', parsed);
            return parsed;
        } catch (error) {
            console.error('AI parsing error:', error);
            // Фолбэк: возвращаем просто текст как title
            return {
                title: speechText,
                priority: 'medium',
                assignee: 'Я',
            };
        }
    }
}

// Singleton instance
export const aiTaskParser = new AITaskParser();

