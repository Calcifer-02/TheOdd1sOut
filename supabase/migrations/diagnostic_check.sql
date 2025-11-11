-- Диагностический скрипт для проверки данных mood_test_results
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем, существует ли таблица
SELECT
    tablename,
    schemaname
FROM pg_tables
WHERE tablename = 'mood_test_results';

-- 2. Смотрим структуру таблицы
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'mood_test_results'
ORDER BY ordinal_position;

-- 3. Считаем общее количество записей
SELECT COUNT(*) as total_records
FROM mood_test_results;

-- 4. Смотрим все уникальные user_id
SELECT
    user_id,
    COUNT(*) as tests_count,
    MIN(completed_at) as first_test,
    MAX(completed_at) as last_test
FROM mood_test_results
GROUP BY user_id
ORDER BY tests_count DESC;

-- 5. Показываем последние 20 записей
SELECT
    id,
    user_id,
    total_score,
    stress_score,
    coping_score,
    stress_level,
    completed_at,
    created_at
FROM mood_test_results
ORDER BY completed_at DESC
LIMIT 20;

-- 6. Проверяем RLS (Row Level Security)
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'mood_test_results';

-- 7. Смотрим политики доступа
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'mood_test_results';

-- 8. Проверка конкретного user_id (ЗАМЕНИТЕ 123456 на ваш user_id из консоли)
-- Раскомментируйте и вставьте свой user_id:

/*
SELECT
    id,
    user_id,
    total_score,
    stress_score,
    coping_score,
    stress_level,
    completed_at
FROM mood_test_results
WHERE user_id = 123456  -- ЗАМЕНИТЕ НА ВАШ USER_ID
ORDER BY completed_at DESC;
*/

