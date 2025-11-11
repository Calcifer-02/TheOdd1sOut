'use client';

import { useState } from 'react';
import ClientLayout from '@/components/layout/ClientLayout';
import { Container, Button } from '@maxhub/max-ui';
import { Plus } from 'lucide-react';

import { useTasks } from '@/hooks/useTasks';
import { useTaskFilters } from '@/hooks/useTaskFilters';
import { useShare } from '@/hooks/useShare';
import { useMaxUser } from '@/hooks/useMaxUser';
import { getFormattedDate } from '@/utils/date';

import { TasksHeader } from '@/features/tasks/components/TasksHeader';
import { TasksView } from '@/features/tasks/components/TasksView';
import { TasksSkeleton } from '@/components/tasks/TasksSkeleton';
import { TasksEmptyState } from '@/components/tasks/TasksEmptyState';
import { FilterPanel } from '@/features/tasks/components/FilterPanel';
import { NewTaskModal } from '@/features/tasks/components/NewTaskModal';
import UndoNotification from '@/components/ui/UndoNotification';
import { TaskDetailsModal } from '@/components/tasks/TaskDetailsModal';
import { Task } from '@/types/task';

export default function TasksPage() {
    const { user } = useMaxUser();
    console.log('🔍 [TasksPage] Current user:', user);

    const { tasks, isLoading, toggleTask, createTask, reorderTasks, updateTask, useAPI, pendingDelete, cancelDelete, dismissNotification } = useTasks();
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
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);

    const formattedDate = getFormattedDate();
    const { handleShare } = useShare(filteredTasks, formattedDate);

    const handleTaskClick = (task: Task) => {
        setSelectedTask(task);
        setIsTaskDetailsOpen(true);
    };

    const handleCloseTaskDetails = () => {
        setIsTaskDetailsOpen(false);
        setSelectedTask(null);
    };

    return (
        <ClientLayout>
            <Container fullWidth>
                <div style={{ padding: '16px 16px 0 16px'}}>
                    {/* Индикатор API статуса (только для разработки) */}
                    {process.env.NODE_ENV === 'development' && (
                        <div style={{
                            position: 'fixed',
                            top: '10px',
                            right: '10px',
                            padding: '8px 12px',
                            background: useAPI ? '#10B981' : '#F59E0B',
                            color: 'white',
                            borderRadius: '8px',
                            fontSize: '12px',
                            fontWeight: 600,
                            zIndex: 9999,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}>
                            {useAPI ? '🟢 API' : '🟡 Local'}
                        </div>
                    )}

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
                            onTaskClick={handleTaskClick}
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

            <TaskDetailsModal
                isOpen={isTaskDetailsOpen}
                onClose={handleCloseTaskDetails}
                task={selectedTask}
                onUpdate={updateTask}
            />

            {/* Уведомление об удалении с возможностью отмены */}
            {pendingDelete && (
                <UndoNotification
                    message={`Задача "${pendingDelete.task.title}" будет удалена`}
                    onUndo={cancelDelete}
                    onDismiss={dismissNotification}
                    duration={5000}
                />
            )}
        </ClientLayout>
    );
}