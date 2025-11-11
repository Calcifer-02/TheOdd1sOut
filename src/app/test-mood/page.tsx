'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './test-mood.module.css';

export default function TestMoodPage() {
    const [userId, setUserId] = useState('');
    const router = useRouter();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (userId) {
            // Сохраняем в localStorage для использования в профиле
            localStorage.setItem('debug_user_id', userId);
            router.push('/profile?tab=mood');
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.card}>
                <h1 className={styles.title}>🔧 Тестирование аналитики стресса</h1>
                <p className={styles.description}>
                    Эта страница для локальной разработки. Введите любой user_id для тестирования.
                </p>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="userId" className={styles.label}>
                            User ID:
                        </label>
                        <input
                            type="number"
                            id="userId"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            placeholder="Например: 6795654048"
                            className={styles.input}
                            required
                        />
                        <small className={styles.hint}>
                            Используйте user_id, для которого есть данные в таблице mood_test_results
                        </small>
                    </div>

                    <button type="submit" className={styles.button}>
                        Открыть аналитику
                    </button>
                </form>

                <div className={styles.instructions}>
                    <h3>📋 Инструкция:</h3>
                    <ol>
                        <li>
                            Откройте Supabase SQL Editor и выполните:
                            <pre className={styles.code}>
{`SELECT DISTINCT user_id 
FROM mood_test_results 
LIMIT 10;`}
              </pre>
                        </li>
                        <li>Скопируйте любой user_id из результата</li>
                        <li>Вставьте его в поле выше</li>
                        <li>Нажмите "Открыть аналитику"</li>
                    </ol>

                    <div className={styles.divider} />

                    <h3>💡 Или создайте тестовые данные:</h3>
                    <pre className={styles.code}>
{`-- Используйте любой user_id (например 999999)
INSERT INTO mood_test_results 
(user_id, test_type, total_score, stress_score, 
 coping_score, stress_level, answers, completed_at) 
VALUES
(999999, 'PSS', 25, 15, 10, 'medium', '{}', NOW() - INTERVAL '7 days'),
(999999, 'PSS', 21, 13, 8, 'medium', '{}', NOW() - INTERVAL '3 days'),
(999999, 'PSS', 17, 10, 7, 'low', '{}', NOW());`}
          </pre>
                    <p className={styles.hint}>
                        Затем используйте user_id <code>999999</code> в форме выше
                    </p>
                </div>

                <div className={styles.warning}>
                    <strong>⚠️ Важно:</strong> Эта страница только для разработки.
                    В продакшене user_id будет получаться из MAX API автоматически.
                </div>
            </div>
        </div>
    );
}