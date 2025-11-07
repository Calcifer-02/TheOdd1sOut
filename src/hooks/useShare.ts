import { Task } from '@/types/task';
import { generateShareText, fallbackCopyToClipboard } from '@/utils/share';

export const useShare = (tasks: Task[], formattedDate: string) => {
    const handleShare = async () => {
        if (typeof window === 'undefined') return;

        const shareText = generateShareText(tasks, formattedDate);
        const shareUrl = `${window.location.origin}${window.location.pathname}`;

        if (navigator && navigator.share) {
            try {
                await navigator.share({
                    title: `Мой прогресс на ${formattedDate}`,
                    text: shareText,
                    url: shareUrl,
                });
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Ошибка при шаринге:', error);
                    fallbackCopyToClipboard(shareText, shareUrl);
                }
            }
        } else {
            fallbackCopyToClipboard(shareText, shareUrl);
        }
    };

    return {
        handleShare,
    };
};