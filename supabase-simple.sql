-- ПРОСТАЯ СХЕМА БЕЗ ПОЛЬЗОВАТЕЛЕЙ
-- Выполните в Supabase Dashboard → SQL Editor

-- Только таблица задач (без users!)
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    deadline TIMESTAMPTZ,
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    assignee TEXT DEFAULT 'Я',
    tags TEXT[] DEFAULT '{}',
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks("order");

-- Триггер для updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Тестовые задачи (БЕЗ user_id!)
INSERT INTO tasks (title, description, priority, deadline, "order", assignee, tags, completed)
VALUES
    ('Подготовить презентацию', 'Сделать слайды для встречи с клиентом', 'high', NOW() + INTERVAL '1 day', 0, 'Я', ARRAY['работа', 'срочно'], FALSE),
    ('Купить продукты', 'Молоко, хлеб, яйца', 'medium', NOW() + INTERVAL '3 hours', 1, 'Я', ARRAY['личное'], FALSE),
    ('Написать отчет', 'Квартальный отчет по проекту', 'high', NOW() + INTERVAL '2 days', 2, 'Я', ARRAY['работа'], FALSE),
    ('Позвонить маме', '', 'low', NULL, 3, 'Я', ARRAY['личное'], FALSE),
    ('Проверить почту', 'Ответить на важные письма', 'medium', NULL, 4, 'Я', ARRAY['работа'], TRUE)
ON CONFLICT DO NOTHING;

-- Проверка
SELECT 'tasks' as table_name, COUNT(*) as count FROM tasks;

