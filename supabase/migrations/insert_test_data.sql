-- Вставка тестовых данных для демонстрации аналитики
-- Замените 123456 на реальный user_id из вашей системы

-- Данные за последние 2 месяца с разной динамикой
-- Тенденция: сначала высокий стресс, затем улучшение

-- 2 месяца назад - высокий стресс
INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(123456, 'PSS', 38, 24, 14, 'high', '{"1":5,"2":5,"3":4,"4":2,"5":2,"6":4,"7":3,"8":2,"9":5,"10":4}', NOW() - INTERVAL '60 days'),
(123456, 'PSS', 36, 23, 13, 'high', '{"1":4,"2":5,"3":5,"4":2,"5":2,"6":4,"7":2,"8":3,"9":4,"10":5}', NOW() - INTERVAL '53 days');

-- 1.5 месяца назад - все еще высокий, но начинается улучшение
INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(123456, 'PSS', 34, 22, 12, 'high', '{"1":4,"2":4,"3":5,"4":2,"5":3,"6":4,"7":2,"8":3,"9":4,"10":5}', NOW() - INTERVAL '45 days'),
(123456, 'PSS', 32, 20, 12, 'high', '{"1":4,"2":4,"3":4,"4":3,"5":3,"6":4,"7":2,"8":3,"9":3,"10":4}', NOW() - INTERVAL '38 days');

-- 1 месяц назад - переход к умеренному уровню
INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(123456, 'PSS', 29, 18, 11, 'medium', '{"1":3,"2":4,"3":4,"4":3,"5":3,"6":3,"7":3,"8":3,"9":4,"10":3}', NOW() - INTERVAL '30 days'),
(123456, 'PSS', 27, 17, 10, 'medium', '{"1":3,"2":3,"3":4,"4":3,"5":3,"6":3,"7":3,"8":3,"9":3,"10":4}', NOW() - INTERVAL '23 days');

-- 3 недели назад - стабилизация на умеренном уровне
INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(123456, 'PSS', 25, 15, 10, 'medium', '{"1":3,"2":3,"3":3,"4":3,"5":4,"6":3,"7":3,"8":3,"9":3,"10":3}', NOW() - INTERVAL '21 days'),
(123456, 'PSS', 26, 16, 10, 'medium', '{"1":3,"2":3,"3":3,"4":3,"5":3,"6":4,"7":3,"8":3,"9":3,"10":3}', NOW() - INTERVAL '14 days');

-- 2 недели назад - продолжение улучшения
INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(123456, 'PSS', 23, 14, 9, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":3,"6":3,"7":3,"8":3,"9":3,"10":3}', NOW() - INTERVAL '10 days'),
(123456, 'PSS', 21, 13, 8, 'medium', '{"1":2,"2":3,"3":3,"4":4,"5":4,"6":2,"7":4,"8":3,"9":3,"10":3}', NOW() - INTERVAL '7 days');

-- Последняя неделя - низкий уровень стресса
INSERT INTO mood_test_results (user_id, test_type, total_score, stress_score, coping_score, stress_level, answers, completed_at) VALUES
(123456, 'PSS', 19, 11, 8, 'low', '{"1":2,"2":2,"3":3,"4":4,"5":4,"6":2,"7":4,"8":4,"9":2,"10":2}', NOW() - INTERVAL '3 days'),
(123456, 'PSS', 17, 10, 7, 'low', '{"1":2,"2":2,"3":2,"4":4,"5":4,"6":2,"7":4,"8":4,"9":2,"10":2}', NOW() - INTERVAL '1 day');

-- Проверка вставленных данных
SELECT
    completed_at::date as test_date,
    total_score,
    stress_score,
    coping_score,
    stress_level
FROM mood_test_results
WHERE user_id = 123456
ORDER BY completed_at DESC;

-- Статистика по вставленным данным
SELECT
    COUNT(*) as total_tests,
    ROUND(AVG(total_score), 1) as avg_total_score,
    ROUND(AVG(stress_score), 1) as avg_stress_score,
    ROUND(AVG(coping_score), 1) as avg_coping_score,
    MIN(total_score) as min_score,
    MAX(total_score) as max_score
FROM mood_test_results
WHERE user_id = 123456;

