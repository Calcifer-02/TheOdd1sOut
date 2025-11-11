-- Создание таблицы для хранения результатов PSS тестов
CREATE TABLE IF NOT EXISTS mood_test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT NOT NULL,
  test_type VARCHAR(50) NOT NULL DEFAULT 'PSS',
  total_score INTEGER NOT NULL,
  stress_score INTEGER NOT NULL,
  coping_score INTEGER NOT NULL,
  stress_level VARCHAR(50) NOT NULL,
  answers JSONB NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_mood_test_results_user_id ON mood_test_results(user_id);
CREATE INDEX IF NOT EXISTS idx_mood_test_results_completed_at ON mood_test_results(completed_at);
CREATE INDEX IF NOT EXISTS idx_mood_test_results_user_completed ON mood_test_results(user_id, completed_at DESC);

-- Комментарии к таблице
COMMENT ON TABLE mood_test_results IS 'Результаты психологических тестов (Perceived Stress Scale)';
COMMENT ON COLUMN mood_test_results.user_id IS 'ID пользователя из Telegram';
COMMENT ON COLUMN mood_test_results.test_type IS 'Тип теста (PSS)';
COMMENT ON COLUMN mood_test_results.total_score IS 'Общий балл теста (0-50)';
COMMENT ON COLUMN mood_test_results.stress_score IS 'Балл по субшкале перенапряжения (0-30)';
COMMENT ON COLUMN mood_test_results.coping_score IS 'Балл по субшкале противодействия стрессу (0-20)';
COMMENT ON COLUMN mood_test_results.stress_level IS 'Уровень стресса (low/medium/high)';
COMMENT ON COLUMN mood_test_results.answers IS 'JSON с ответами на вопросы';
COMMENT ON COLUMN mood_test_results.completed_at IS 'Дата и время завершения теста';

