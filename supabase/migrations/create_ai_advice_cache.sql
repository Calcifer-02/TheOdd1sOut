-- Таблица для кеширования AI-советов
CREATE TABLE IF NOT EXISTS ai_advice_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id BIGINT NOT NULL,
    total_score INTEGER NOT NULL,
    stress_score INTEGER NOT NULL,
    coping_score INTEGER NOT NULL,
    stress_level TEXT NOT NULL CHECK (stress_level IN ('low', 'medium', 'high')),
    trend TEXT CHECK (trend IN ('improving', 'stable', 'worsening', 'insufficient_data')),
    advice JSONB NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('ai', 'fallback')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
    UNIQUE(user_id, stress_level, trend)
);

-- Индексы для быстрого поиска
CREATE INDEX idx_ai_advice_cache_user_id ON ai_advice_cache(user_id);
CREATE INDEX idx_ai_advice_cache_expires_at ON ai_advice_cache(expires_at);
CREATE INDEX idx_ai_advice_cache_user_stress ON ai_advice_cache(user_id, stress_level, trend);

-- Автоматическое удаление устаревших советов
CREATE OR REPLACE FUNCTION delete_expired_advice()
RETURNS void AS $$
BEGIN
    DELETE FROM ai_advice_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Комментарии
COMMENT ON TABLE ai_advice_cache IS 'Кеш AI-советов для пользователей';
COMMENT ON COLUMN ai_advice_cache.expires_at IS 'Советы актуальны 7 дней, потом обновляются';
COMMENT ON COLUMN ai_advice_cache.advice IS 'JSON массив советов от AI';

