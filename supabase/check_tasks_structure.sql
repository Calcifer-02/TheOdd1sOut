-- Проверка структуры таблицы tasks

-- 1. Проверить наличие колонки user_id
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'tasks'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Проверить наличие индекса
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'tasks'
  AND schemaname = 'public';

-- 3. Проверить данные в tasks (есть ли user_id)
SELECT
    id,
    title,
    user_id,
    created_at
FROM tasks
ORDER BY created_at DESC
LIMIT 10;

-- 4. Статистика по user_id
SELECT
    user_id,
    COUNT(*) as task_count
FROM tasks
GROUP BY user_id
ORDER BY task_count DESC;

