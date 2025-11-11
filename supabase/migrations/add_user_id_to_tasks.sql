-- Добавляем колонку user_id в таблицу tasks
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- Создаем индекс для быстрого поиска задач по пользователю
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);

-- Комментарий
COMMENT ON COLUMN tasks.user_id IS 'ID пользователя из MAX (Telegram user ID)';

-- Примечание: колонка user_id nullable, чтобы поддерживать старые задачи без user_id

