import { Panel, Typography, CellList, CellSimple } from '@maxhub/max-ui';
import { CheckCircle2 } from 'lucide-react';
import { REMINDER_OPTIONS } from '@/shared/constants/tasks';

interface ReminderPickerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedReminder: string;
    onSelect: (reminder: string) => void;
}

export const ReminderPicker = ({
                                   isOpen,
                                   onClose,
                                   selectedReminder,
                                   onSelect,
                               }: ReminderPickerProps) => {
    if (!isOpen) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 10000,
                display: 'flex',
                alignItems: 'flex-end',
                paddingTop: '60px',
            }}
            onClick={onClose}
        >
            <Panel
                mode="primary"
                style={{
                    width: '100%',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
                    <Typography.Headline>Напоминание</Typography.Headline>
                </div>
                <div style={{ padding: '16px' }}>
                    <CellList>
                        {REMINDER_OPTIONS.map((reminder) => (
                            <CellSimple
                                key={reminder}
                                onClick={() => {
                                    onSelect(reminder === 'Не установлено' ? '' : reminder);
                                    onClose();
                                }}
                                after={
                                    selectedReminder === (reminder === 'Не установлено' ? '' : reminder) &&
                                    <CheckCircle2 size={20} color="#3B82F6" />
                                }
                            >
                                {reminder}
                            </CellSimple>
                        ))}
                    </CellList>
                </div>
            </Panel>
        </div>
    );
};