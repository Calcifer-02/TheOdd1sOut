import { useState, useEffect, useRef } from 'react';

interface UseSpeechRecognitionOptions {
    onResult?: (transcript: string) => void;
    onError?: (error: string) => void;
    lang?: string;
    continuous?: boolean;
}

interface UseSpeechRecognitionReturn {
    transcript: string;
    isListening: boolean;
    isSupported: boolean;
    startListening: () => Promise<void>;
    stopListening: () => void;
    resetTranscript: () => void;
}

export const useSpeechRecognition = ({
    onResult,
    onError,
    lang = 'ru-RU',
    continuous = false,
}: UseSpeechRecognitionOptions = {}): UseSpeechRecognitionReturn => {
    const [transcript, setTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        // Проверяем поддержку Web Speech API
        const SpeechRecognition =
            (window as any).SpeechRecognition ||
            (window as any).webkitSpeechRecognition;

        if (SpeechRecognition) {
            setIsSupported(true);
            recognitionRef.current = new SpeechRecognition();

            const recognition = recognitionRef.current;
            recognition.lang = lang;
            recognition.continuous = continuous;
            recognition.interimResults = true;

            recognition.onresult = (event: any) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcriptPart = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalTranscript += transcriptPart + ' ';
                    } else {
                        interimTranscript += transcriptPart;
                    }
                }

                const fullTranscript = (finalTranscript || interimTranscript).trim();
                setTranscript(fullTranscript);

                if (finalTranscript && onResult) {
                    onResult(fullTranscript);
                }
            };

            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);

                const errorMessage = getErrorMessage(event.error);
                if (onError) {
                    onError(errorMessage);
                }
            };

            recognition.onend = () => {
                setIsListening(false);
            };
        } else {
            setIsSupported(false);
            console.warn('Speech recognition is not supported in this browser');
        }

        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, [lang, continuous, onResult, onError]);

    const startListening = async (): Promise<void> => {
        if (!isSupported || !recognitionRef.current) {
            const error = 'Speech recognition is not supported';
            if (onError) onError(error);
            return;
        }

        try {
            // Запрашиваем разрешение на микрофон
            await navigator.mediaDevices.getUserMedia({ audio: true });

            setTranscript('');
            recognitionRef.current.start();
            setIsListening(true);
        } catch (error: any) {
            console.error('Microphone access error:', error);
            const errorMessage = error.name === 'NotAllowedError'
                ? 'Доступ к микрофону запрещен. Разрешите доступ в настройках браузера.'
                : 'Не удалось получить доступ к микрофону';
            if (onError) onError(errorMessage);
        }
    };

    const stopListening = () => {
        if (recognitionRef.current && isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    const resetTranscript = () => {
        setTranscript('');
    };

    return {
        transcript,
        isListening,
        isSupported,
        startListening,
        stopListening,
        resetTranscript,
    };
};

// Вспомогательная функция для человекопонятных сообщений об ошибках
function getErrorMessage(error: string): string {
    switch (error) {
        case 'not-allowed':
        case 'permission-denied':
            return 'Доступ к микрофону запрещен';
        case 'no-speech':
            return 'Речь не распознана. Попробуйте еще раз';
        case 'audio-capture':
            return 'Микрофон не найден или недоступен';
        case 'network':
            return 'Ошибка сети. Проверьте подключение к интернету';
        case 'aborted':
            return 'Распознавание отменено';
        default:
            return 'Ошибка распознавания речи';
    }
}

