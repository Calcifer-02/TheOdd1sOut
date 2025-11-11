'use client';

import React from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceInputButtonProps {
    isListening: boolean;
    isSupported: boolean;
    // @ts-ignore TS71007
    onStart: () => void;
    // @ts-ignore TS71007
    onStop: () => void;
}

const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({
    isListening,
    isSupported,
    onStart,
    onStop,
}) => {
    if (!isSupported) {
        return null;
    }

    return (
        <button
            type="button"
            onClick={isListening ? onStop : onStart}
            style={{
                background: isListening ? '#EF4444' : '#007aff',
                border: 'none',
                borderRadius: '50%',
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: isListening
                    ? '0 0 20px rgba(239, 68, 68, 0.5)'
                    : '0 4px 12px rgba(0, 122, 255, 0.3)',
                transition: 'all 0.3s ease',
                animation: isListening ? 'pulse 1.5s ease-in-out infinite' : 'none',
            }}
            title={isListening ? 'Остановить запись' : 'Начать голосовой ввод'}
        >
            <style>{`
                @keyframes pulse {
                    0%, 100% {
                        transform: scale(1);
                        box-shadow: 0 0 20px rgba(239, 68, 68, 0.5);
                    }
                    50% {
                        transform: scale(1.05);
                        box-shadow: 0 0 30px rgba(239, 68, 68, 0.8);
                    }
                }
            `}</style>
            {isListening ? (
                <MicOff size={24} color="white" />
            ) : (
                <Mic size={24} color="white" />
            )}
        </button>
    );
};
export default VoiceInputButton

