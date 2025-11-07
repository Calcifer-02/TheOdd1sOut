import { Task } from '@/types/task';

export const generateShareText = (tasks: Task[], formattedDate: string): string => {
    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    return `📋 Мой прогресс на ${formattedDate}

✅ Выполнено: ${completedCount} из ${totalCount} задач (${completionRate}%)

${tasks.slice(0, 3).map((task, index) =>
        `${index + 1}. ${task.completed ? '✅' : '⬜'} ${task.title}`
    ).join('\n')}${tasks.length > 3 ? `\n...и ещё ${tasks.length - 3}` : ''}

#продуктивность #задачи`;
};

export const fallbackCopyToClipboard = async (text: string, url: string) => {
    if (typeof window === 'undefined') return;

    try {
        if (navigator && navigator.clipboard) {
            await navigator.clipboard.writeText(`${text}\n\n${url}`);
            alert('Ссылка скопирована в буфер обмена!');
        }
    } catch (error) {
        console.error('Ошибка копирования:', error);
        alert('Не удалось скопировать ссылку');
    }
};