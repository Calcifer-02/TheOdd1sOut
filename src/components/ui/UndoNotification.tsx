import React, { useEffect } from 'react';
import { Button } from '@maxhub/max-ui';
import { X, Undo2 } from 'lucide-react';

interface UndoNotificationProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number;
}

export const UndoNotification: React.FC<UndoNotificationProps> = ({
  message,
  onUndo,
  onDismiss,
  duration = 5000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--vkui--color_background_modal)',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        zIndex: 10000,
        minWidth: '300px',
        maxWidth: '90%',
        animation: 'slideUp 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>

      <div style={{ flex: 1, fontSize: '14px', color: 'var(--vkui--color_text_primary)' }}>
        {message}
      </div>

      <Button
        appearance="neutral"
        mode="tertiary"
        size="medium"
        onClick={onUndo}
        iconBefore={<Undo2 size={16} />}
        style={{
          padding: '6px 12px',
          fontSize: '14px',
          fontWeight: 600,
        }}
      >
        Отменить
      </Button>

      <button
        onClick={onDismiss}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--vkui--color_text_secondary)',
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
};

