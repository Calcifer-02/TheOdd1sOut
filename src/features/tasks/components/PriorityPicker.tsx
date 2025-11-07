import { Panel, Typography, CellList, CellSimple } from '@maxhub/max-ui';
import { CheckCircle2 } from 'lucide-react';
import { PRIORITIES } from '@/shared/constants/tasks';

interface PriorityPickerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedPriority: 'low' | 'medium' | 'high';
    onSelect: (priority: 'low' | 'medium' | 'high') => void;
}

export const PriorityPicker = ({
                                   isOpen,
                                   onClose,
                                   selectedPriority,
                                   onSelect
                               }: PriorityPickerProps) => {
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
                    <Typography.Headline>Выбор приоритета</Typography.Headline>
                </div>
                <div style={{ padding: '16px' }}>
                    <CellList>
                        {Object.entries(PRIORITIES).map(([key, value]) => (
                            <CellSimple
                                key={key}
                                onClick={() => {
                                    onSelect(key as 'low' | 'medium' | 'high');
                                    onClose();
                                }}
                                before={
                                    <div
                                        style={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: value.color,
                                        }}
                                    />
                                }
                                after={
                                    selectedPriority === key && <CheckCircle2 size={20} color="#3B82F6" />
                                }
                            >
                                {value.label}
                            </CellSimple>
                        ))}
                    </CellList>
                </div>
            </Panel>
        </div>
    );
};