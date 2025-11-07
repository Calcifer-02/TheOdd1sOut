import { Panel, Typography, CellList, CellSimple } from '@maxhub/max-ui';
import { CheckCircle2 } from 'lucide-react';
import { ASSIGNEES } from '@/shared/constants/tasks';

interface AssigneePickerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedAssignee: string;
    onSelect: (assignee: string) => void;
}

export const AssigneePicker = ({
                                   isOpen,
                                   onClose,
                                   selectedAssignee,
                                   onSelect,
                               }: AssigneePickerProps) => {
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
                    <Typography.Headline>Выбор исполнителя</Typography.Headline>
                </div>
                <div style={{ padding: '16px' }}>
                    <CellList>
                        {ASSIGNEES.map((assignee) => (
                            <CellSimple
                                key={assignee.id}
                                onClick={() => {
                                    onSelect(assignee.name);
                                    onClose();
                                }}
                                after={
                                    selectedAssignee === assignee.name &&
                                    <CheckCircle2 size={20} color="#3B82F6" />
                                }
                            >
                                {assignee.name}
                            </CellSimple>
                        ))}
                    </CellList>
                </div>
            </Panel>
        </div>
    );
};