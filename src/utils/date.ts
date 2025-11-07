export const getFormattedDate = (): string => {
    if (typeof window === 'undefined') return '';

    const today = new Date();
    const dateString = today.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        weekday: 'long',
    });
    const [day, month, weekday] = dateString.split(' ');
    return `${day} ${month}, ${weekday}`;
};