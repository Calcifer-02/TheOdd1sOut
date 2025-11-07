import { Typography, Button } from '@maxhub/max-ui';
import { Plus, CheckCircle2, Sparkles, Brain } from 'lucide-react';

interface TasksEmptyStateProps {
    hasTasks: boolean;
    onCreateTask: () => void;
}

export const TasksEmptyState = ({ hasTasks, onCreateTask }: TasksEmptyStateProps) => (
    <div
        style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            textAlign: 'center',
        }}
    >
        <div
            style={{
                position: 'relative',
                width: '160px',
                height: '160px',
                marginBottom: '24px',
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '140px',
                    height: '140px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
                    opacity: 0.6,
                }}
            />

            <div
                style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            >
                <CheckCircle2 size={64} color="#3B82F6" strokeWidth={1.5} />
            </div>

            <div
                style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    animation: 'float 3s ease-in-out infinite',
                }}
            >
                <Sparkles size={24} color="#F59E0B" />
            </div>

            <div
                style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    animation: 'float 3s ease-in-out infinite 1s',
                }}
            >
                <Brain size={28} color="#8B5CF6" />
            </div>
        </div>

        <Typography.Headline style={{ marginBottom: '8px', color: '#1F2937' }}>
            Всё сделано!
        </Typography.Headline>

        <Typography.Body style={{ marginBottom: '24px', color: '#6B7280', maxWidth: '280px' }}>
            {hasTasks
                ? 'Нет задач по выбранным фильтрам'
                : 'У вас пока нет задач. Создайте свою первую задачу и начните путь к продуктивности!'}
        </Typography.Body>

        <Button
            appearance="themed"
            mode="primary"
            size="medium"
            onClick={onCreateTask}
            iconBefore={<Plus size={20} />}
        >
            Создать задачу
        </Button>

        <style>{`
      @keyframes float {
        0%, 100% {
          transform: translateY(0px);
        }
        50% {
          transform: translateY(-10px);
        }
      }
    `}</style>
    </div>
);