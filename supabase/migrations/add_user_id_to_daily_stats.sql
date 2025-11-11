-- Добавляем колонку user_id в таблицу daily_stats
ALTER TABLE daily_stats
ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_daily_stats_user_id ON daily_stats(user_id);

-- Комментарий
COMMENT ON COLUMN daily_stats.user_id IS 'ID пользователя из MAX';
-- Добавляем колонку user_id в таблицу completed_tasks
ALTER TABLE completed_tasks
ADD COLUMN IF NOT EXISTS user_id BIGINT;

-- Создаем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_completed_tasks_user_id ON completed_tasks(user_id);

-- Комментарий
COMMENT ON COLUMN completed_tasks.user_id IS 'ID пользователя из MAX';

