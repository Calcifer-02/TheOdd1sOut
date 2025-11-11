-- Расширенный набор тестовых данных для демонстрации различных сценариев
-- ВАЖНО: Замените user_id на реальные ID из вашей системы

-- =============================================================================
-- Сценарий 1: Пользователь с улучшением (user_id = 123456)
-- От высокого стресса к низкому за 2 месяца
-- =============================================================================

-- См. файл insert_test_data.sql для основных данных

-- =============================================================================
-- Сценарий 2: Пользователь со стабильным низким стрессом (user_id = 789012)
-- =============================================================================

INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(789012, 'PSS', 15, 9, 6, 'low', '{"1":1,"2":2,"3":2,"4":4,"5":4,"6":1,"7":5,"8":4,"9":2,"10":2}', NOW() - INTERVAL '60 days'),
(789012, 'PSS', 16, 9, 7, 'low', '{"1":2,"2":2,"3":2,"4":4,"5":4,"6":1,"7":4,"8":4,"9":2,"10":2}', NOW() - INTERVAL '45 days'),
(789012, 'PSS', 14, 8, 6, 'low', '{"1":1,"2":2,"3":2,"4":5,"5":4,"6":1,"7":5,"8":4,"9":1,"10":2}', NOW() - INTERVAL '30 days'),
(789012, 'PSS', 17, 10, 7, 'low', '{"1":2,"2":2,"3":2,"4":4,"5":4,"6":2,"7":4,"8":4,"9":2,"10":2}', NOW() - INTERVAL '15 days'),
(789012, 'PSS', 15, 9, 6, 'low', '{"1":1,"2":2,"3":2,"4":4,"5":5,"6":1,"7":5,"8":4,"9":2,"10":1}', NOW() - INTERVAL '7 days'),
(789012, 'PSS', 16, 9, 7, 'low', '{"1":2,"2":2,"3":2,"4":4,"5":4,"6":1,"7":4,"8":5,"9":2,"10":2}', NOW() - INTERVAL '1 day');

-- =============================================================================
-- Сценарий 3: Пользователь с ухудшением (user_id = 345678)
-- От умеренного к высокому стрессу
-- =============================================================================

INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(345678, 'PSS', 22, 13, 9, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":4,"6":2,"7":4,"8":3,"9":3,"10":2}', NOW() - INTERVAL '60 days'),
(345678, 'PSS', 24, 15, 9, 'medium', '{"1":3,"2":3,"3":3,"4":3,"5":4,"6":3,"7":4,"8":3,"9":3,"10":3}', NOW() - INTERVAL '45 days'),
(345678, 'PSS', 27, 17, 10, 'medium', '{"1":3,"2":3,"3":4,"4":3,"5":3,"6":3,"7":3,"8":3,"9":3,"10":4}', NOW() - INTERVAL '30 days'),
(345678, 'PSS', 31, 20, 11, 'high', '{"1":4,"2":4,"3":4,"4":3,"5":3,"6":4,"7":3,"8":3,"9":4,"10":3}', NOW() - INTERVAL '15 days'),
(345678, 'PSS', 35, 22, 13, 'high', '{"1":4,"2":4,"3":5,"4":2,"5":3,"6":4,"7":3,"8":3,"9":4,"10":5}', NOW() - INTERVAL '7 days'),
(345678, 'PSS', 37, 24, 13, 'high', '{"1":5,"2":4,"3":5,"4":2,"5":2,"6":5,"7":3,"8":3,"9":5,"10":4}', NOW() - INTERVAL '1 day');

-- =============================================================================
-- Сценарий 4: Пользователь с волнообразной динамикой (user_id = 567890)
-- Периоды улучшения и ухудшения
-- =============================================================================

INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(567890, 'PSS', 28, 18, 10, 'medium', '{"1":3,"2":4,"3":4,"4":3,"5":3,"6":3,"7":3,"8":3,"9":3,"10":4}', NOW() - INTERVAL '70 days'),
(567890, 'PSS', 21, 13, 8, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":4,"6":2,"7":4,"8":3,"9":3,"10":2}', NOW() - INTERVAL '60 days'),
(567890, 'PSS', 19, 11, 8, 'low', '{"1":2,"2":2,"3":3,"4":4,"5":4,"6":2,"7":4,"8":4,"9":2,"10":2}', NOW() - INTERVAL '50 days'),
(567890, 'PSS', 26, 16, 10, 'medium', '{"1":3,"2":3,"3":4,"4":3,"5":3,"6":3,"7":3,"8":3,"9":4,"10":3}', NOW() - INTERVAL '40 days'),
(567890, 'PSS', 23, 14, 9, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":3,"6":3,"7":3,"8":3,"9":3,"10":3}', NOW() - INTERVAL '30 days'),
(567890, 'PSS', 18, 11, 7, 'low', '{"1":2,"2":2,"3":2,"4":4,"5":4,"6":2,"7":4,"8":4,"9":2,"10":3}', NOW() - INTERVAL '20 days'),
(567890, 'PSS', 25, 15, 10, 'medium', '{"1":3,"2":3,"3":3,"4":3,"5":3,"6":3,"7":3,"8":3,"9":3,"10":4}', NOW() - INTERVAL '10 days'),
(567890, 'PSS', 22, 13, 9, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":3,"6":2,"7":4,"8":3,"9":3,"10":3}', NOW() - INTERVAL '3 days');

-- =============================================================================
-- Сценарий 5: Новый пользователь с несколькими тестами (user_id = 901234)
-- Недостаточно данных для определения тренда
-- =============================================================================

INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(901234, 'PSS', 24, 15, 9, 'medium', '{"1":3,"2":3,"3":3,"4":3,"5":3,"6":3,"7":3,"8":3,"9":3,"10":3}', NOW() - INTERVAL '14 days'),
(901234, 'PSS', 26, 16, 10, 'medium', '{"1":3,"2":3,"3":4,"4":3,"5":3,"6":3,"7":3,"8":3,"9":3,"10":4}', NOW() - INTERVAL '7 days'),
(901234, 'PSS', 23, 14, 9, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":3,"6":3,"7":3,"8":3,"9":3,"10":3}', NOW() - INTERVAL '1 day');

-- =============================================================================
-- Проверка и статистика по всем вставленным данным
-- =============================================================================

-- Количество тестов по пользователям
SELECT
    user_id,
    COUNT(*) as tests_count,
    ROUND(AVG(total_score), 1) as avg_score,
    MIN(total_score) as min_score,
    MAX(total_score) as max_score
FROM mood_test_results
WHERE user_id IN (123456, 789012, 345678, 567890, 901234)
GROUP BY user_id
ORDER BY user_id;

-- Распределение по уровням стресса
SELECT
    stress_level,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM mood_test_results
WHERE user_id IN (123456, 789012, 345678, 567890, 901234)
GROUP BY stress_level
ORDER BY
    CASE stress_level
        WHEN 'low' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'high' THEN 3
    END;

-- Последние 5 тестов каждого пользователя
SELECT
    user_id,
    completed_at::date as test_date,
    total_score,
    stress_level
FROM (
    SELECT
        *,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY completed_at DESC) as rn
    FROM mood_test_results
    WHERE user_id IN (123456, 789012, 345678, 567890, 901234)
) t
WHERE rn <= 5
ORDER BY user_id, completed_at DESC;

-- Тренды по пользователям (последние 3 vs предыдущие 3)
WITH recent_tests AS (
    SELECT
        user_id,
        AVG(total_score) as recent_avg,
        COUNT(*) as recent_count
    FROM (
        SELECT
            user_id,
            total_score,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY completed_at DESC) as rn
        FROM mood_test_results
        WHERE user_id IN (123456, 789012, 345678, 567890, 901234)
    ) t
    WHERE rn <= 3
    GROUP BY user_id
),
older_tests AS (
    SELECT
        user_id,
        AVG(total_score) as older_avg,
        COUNT(*) as older_count
    FROM (
        SELECT
            user_id,
            total_score,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY completed_at DESC) as rn
        FROM mood_test_results
        WHERE user_id IN (123456, 789012, 345678, 567890, 901234)
    ) t
    WHERE rn BETWEEN 4 AND 6
    GROUP BY user_id
)
SELECT
    r.user_id,
    ROUND(r.recent_avg, 1) as recent_avg_score,
    ROUND(o.older_avg, 1) as older_avg_score,
    ROUND(r.recent_avg - o.older_avg, 1) as score_change,
    CASE
        WHEN r.recent_avg - o.older_avg < -3 THEN '📈 Улучшение'
        WHEN r.recent_avg - o.older_avg > 3 THEN '📉 Ухудшение'
        ELSE '➡️ Стабильно'
    END as trend
FROM recent_tests r
LEFT JOIN older_tests o ON r.user_id = o.user_id
WHERE o.older_count >= 3
ORDER BY r.user_id;

