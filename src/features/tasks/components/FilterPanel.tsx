import { LayoutMode, SortBy } from '@/types/task';
import { Panel, Typography, CellList, CellSimple, Switch, Button } from '@maxhub/max-ui';
import { List, Grid3x3, Calendar } from 'lucide-react';
import { ASSIGNEES, PRIORITIES, TAGS } from '@/shared/constants/tasks';

interface FilterPanelProps {
    isOpen: boolean;
    onClose: () => void;
    layoutMode: LayoutMode;
    onLayoutChange: (mode: LayoutMode) => void;
    sortBy: SortBy;
    onSortChange: (sort: SortBy) => void;
    selectedAssignees: string[];
    onToggleAssignee: (assignee: string) => void;
    selectedPriorities: string[];
    onTogglePriority: (priority: string) => void;
    selectedTags: string[];
    onToggleTag: (tag: string) => void;
}

export const FilterPanel = ({
                                isOpen,
                                onClose,
                                layoutMode,
                                onLayoutChange,
                                sortBy,
                                onSortChange,
                                selectedAssignees,
                                onToggleAssignee,
                                selectedPriorities,
                                onTogglePriority,
                                selectedTags,
                                onToggleTag,
                            }: FilterPanelProps) => {
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
                zIndex: 9999,
                display: 'flex',
                alignItems: 'flex-end',
            }}
            onClick={onClose}
        >
            <Panel
                mode="primary"
                style={{
                    width: '100%',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB' }}>
                    <Typography.Headline>Настройки</Typography.Headline>
                </div>
                <div style={{ padding: '16px' }}>
                    {/* Выбор раскладки */}
                    <div style={{ marginBottom: '24px' }}>
                        <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
                            Раскладка
                        </Typography.Body>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                            <button
                                onClick={() => onLayoutChange('list')}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: layoutMode === 'list' ? '16px 12px' : '16px 12px',
                                    border: '2px solid',
                                    borderColor: layoutMode === 'list' ? '#3B82F6' : '#E5E7EB',
                                    borderRadius: '12px',
                                    background: layoutMode === 'list' ? '#EFF6FF' : '#F9FAFB',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                }}
                            >
                                <List size={32} color={layoutMode === 'list' ? '#3B82F6' : '#6B7280'} />
                                <Typography.Body style={{ fontSize: '12px', color: layoutMode === 'list' ? '#3B82F6' : '#6B7280' }}>
                                    Список
                                </Typography.Body>
                            </button>
                            <button
                                onClick={() => onLayoutChange('grid')}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '16px 12px',
                                    border: '2px solid',
                                    borderColor: layoutMode === 'grid' ? '#3B82F6' : '#E5E7EB',
                                    borderRadius: '12px',
                                    background: layoutMode === 'grid' ? '#EFF6FF' : '#F9FAFB',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                }}
                            >
                                <Grid3x3 size={32} color={layoutMode === 'grid' ? '#3B82F6' : '#6B7280'} />
                                <Typography.Body style={{ fontSize: '12px', color: layoutMode === 'grid' ? '#3B82F6' : '#6B7280' }}>
                                    Доска
                                </Typography.Body>
                            </button>
                            <button
                                onClick={() => onLayoutChange('calendar')}
                                style={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '16px 12px',
                                    border: '2px solid',
                                    borderColor: layoutMode === 'calendar' ? '#3B82F6' : '#E5E7EB',
                                    borderRadius: '12px',
                                    background: layoutMode === 'calendar' ? '#EFF6FF' : '#F9FAFB',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    outline: 'none',
                                }}
                            >
                                <Calendar size={32} color={layoutMode === 'calendar' ? '#3B82F6' : '#6B7280'} />
                                <Typography.Body style={{ fontSize: '12px', color: layoutMode === 'calendar' ? '#3B82F6' : '#6B7280' }}>
                                    Календарь
                                </Typography.Body>
                            </button>
                        </div>
                    </div>

                    {/* Сортировка */}
                    <div style={{ marginBottom: '24px' }}>
                        <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
                            Сортировка
                        </Typography.Body>
                        <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
                            <CellSimple
                                before={
                                    <Switch
                                        checked={sortBy === 'deadline'}
                                        onChange={() => onSortChange('deadline')}
                                    />
                                }
                            >
                                По дедлайну
                            </CellSimple>
                            <CellSimple
                                before={
                                    <Switch
                                        checked={sortBy === 'priority'}
                                        onChange={() => onSortChange('priority')}
                                    />
                                }
                            >
                                По приоритету
                            </CellSimple>
                            <CellSimple
                                before={
                                    <Switch
                                        checked={sortBy === 'name'}
                                        onChange={() => onSortChange('name')}
                                    />
                                }
                            >
                                По названию
                            </CellSimple>
                        </CellList>
                    </div>

                    {/* Фильтр по исполнителю */}
                    <div style={{ marginBottom: '24px' }}>
                        <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
                            Исполнитель
                        </Typography.Body>
                        <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
                            {ASSIGNEES.map(assignee => (
                                <CellSimple
                                    key={assignee.id}
                                    before={
                                        <Switch
                                            checked={selectedAssignees.includes(assignee.name)}
                                            onChange={() => onToggleAssignee(assignee.name)}
                                        />
                                    }
                                >
                                    {assignee.name}
                                </CellSimple>
                            ))}
                        </CellList>
                    </div>

                    {/* Фильтр по приоритету */}
                    <div style={{ marginBottom: '24px' }}>
                        <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
                            Приоритет
                        </Typography.Body>
                        <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
                            {Object.entries(PRIORITIES).map(([key, value]) => (
                                <CellSimple
                                    key={key}
                                    before={
                                        <Switch
                                            checked={selectedPriorities.includes(key)}
                                            onChange={() => onTogglePriority(key)}
                                        />
                                    }
                                    after={
                                        <div
                                            style={{
                                                width: '12px',
                                                height: '12px',
                                                borderRadius: '50%',
                                                backgroundColor: value.color,
                                            }}
                                        />
                                    }
                                >
                                    {value.label}
                                </CellSimple>
                            ))}
                        </CellList>
                    </div>

                    {/* Фильтр по меткам */}
                    <div style={{ marginBottom: '24px' }}>
                        <Typography.Body style={{ fontWeight: 600, marginBottom: '12px' }}>
                            Метки
                        </Typography.Body>
                        <CellList style={{ background: '#F9FAFB', borderRadius: '12px', padding: '4px' }}>
                            {TAGS.map(tag => (
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
                    </div>

                    <Button
                        appearance="themed"
                        mode="primary"
                        size="large"
                        stretched
                        onClick={onClose}
                    >
                        Применить
                    </Button>
                </div>
            </Panel>
        </div>
    );
};