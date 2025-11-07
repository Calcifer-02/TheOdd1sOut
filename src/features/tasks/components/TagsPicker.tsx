import { Panel, Typography, CellList, CellSimple, Switch, Button } from '@maxhub/max-ui';
import { TAGS } from '@/shared/constants/tasks';

interface TagsPickerProps {
    isOpen: boolean;
    onClose: () => void;
    selectedTags: string[];
    onToggleTag: (tag: string) => void;
}

export const TagsPicker = ({
                               isOpen,
                               onClose,
                               selectedTags,
                               onToggleTag,
                           }: TagsPickerProps) => {
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
                    <Typography.Headline>Выбор меток</Typography.Headline>
                </div>
                <div style={{ padding: '16px' }}>
                    <CellList>
                        {TAGS.map((tag) => (
                            <CellSimple
                                key={tag}
                                before={
                                    <Switch
                                        checked={selectedTags.includes(tag)}
                                        onChange={() => onToggleTag(tag)}
                                    />
                                }
                            >
                                {tag}
                            </CellSimple>
                        ))}
                    </CellList>
                    <Button
                        appearance="themed"
                        mode="primary"
                        size="large"
                        stretched
                        onClick={onClose}
                        style={{ marginTop: '16px' }}
                    >
                        Готово
                    </Button>
                </div>
            </Panel>
        </div>
    );
};