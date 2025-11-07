'use client';

import { useState } from 'react';
import ClientLayout from '@/components/layout/ClientLayout';
import { Container, Button } from '@maxhub/max-ui';
import { Plus } from 'lucide-react';

import { useTasks } from '@/hooks/useTasks';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { useShare } from '@/hooks/useShare';
import { getFormattedDate } from '@/utils/date';

import { TasksHeader } from '@/features/tasks/components/TasksHeader';
import { TasksView } from '@/features/tasks/components/TasksView';
import { TasksSkeleton } from '@/components/tasks/TasksSkeleton';
import { TasksEmptyState } from '@/components/tasks/TasksEmptyState';
import { FilterPanel } from '@/features/tasks/components/FilterPanel';
import { NewTaskModal } from '@/features/tasks/components/NewTaskModal';

export const dynamic = 'force-dynamic';

export default function TasksPage() {
    const { tasks, isLoading, toggleTask, createTask, reorderTasks } = useTasks();
    const {
        layoutMode,
        setLayoutMode,
        sortBy,
        setSortBy,
        selectedAssignees,
        selectedPriorities,
        selectedTags,
        filteredTasks,
        toggleAssignee,
        togglePriority,
        toggleTag,
    } = useTaskFilters(tasks);

    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

    const formattedDate = getFormattedDate();
    const { handleShare } = useShare(filteredTasks, formattedDate);

    return (
        <ClientLayout>
            <Container fullWidth>
                <div style={{ padding: '16px', paddingBottom: '80px' }}>
                    <TasksHeader
                        formattedDate={formattedDate}
                        onShare={handleShare}
                        onOpenFilters={() => setIsFilterPanelOpen(true)}
                    />

                    {isLoading ? (
                        <TasksSkeleton />
                    ) : filteredTasks.length === 0 ? (
                        <TasksEmptyState
                            hasTasks={tasks.length > 0}
                            onCreateTask={() => setIsNewTaskModalOpen(true)}
                        />
                    ) : (
                        <TasksView
                            tasks={filteredTasks}
                            layoutMode={layoutMode}
                            onToggleTask={toggleTask}
                            onReorderTasks={reorderTasks}
                        />
                    )}
                </div>
            </Container>

            {/* FAB кнопка */}
            <Button
                appearance="themed"
                mode="primary"
                size="medium"
                onClick={() => setIsNewTaskModalOpen(true)}
                style={{
                    position: 'fixed',
                    bottom: '80px',
                    right: '16px',
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    padding: 0,
                    minWidth: 'unset',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                }}
            >
                <Plus size={24} />
            </Button>

            <FilterPanel
                isOpen={isFilterPanelOpen}
                onClose={() => setIsFilterPanelOpen(false)}
                layoutMode={layoutMode}
                onLayoutChange={setLayoutMode}
                sortBy={sortBy}
                onSortChange={setSortBy}
                selectedAssignees={selectedAssignees}
                onToggleAssignee={toggleAssignee}
                selectedPriorities={selectedPriorities}
                onTogglePriority={togglePriority}
                selectedTags={selectedTags}
                onToggleTag={toggleTag}
            />

            <NewTaskModal
                isOpen={isNewTaskModalOpen}
                onClose={() => setIsNewTaskModalOpen(false)}
                onCreateTask={createTask}
            />
        </ClientLayout>
    );
}