# 🔍 Отладка фильтрации данных в профиле

## Проблема:
Разделы "Обзор" и "Аналитика" показывают ВСЕ задачи из БД, а не только задачи конкретного пользователя.

## Что добавлено для отладки:

Добавлено подробное логирование в функцию `loadProfileData()`:

```typescript
🔍 [Profile] Loading data for userId: 999999
🔍 [Profile] maxUser: { user_id: 999999, ... }
🔍 [Profile] debugUserId: 999999
✅ [Profile] Applying filter for tasks: user_id.eq.999999 OR user_id.is.null
📊 [Profile] Loaded 5 tasks
✅ [Profile] Applying filter for completed_tasks
📊 [Profile] Loaded 3 completed tasks
✅ [Profile] Applying filter for daily_stats
📊 [Profile] Loaded 7 daily stats
✅ [Profile] Data loading completed
```

## Как проверить:

### Шаг 1: Откройте консоль браузера (F12)

### Шаг 2: Установите debug user_id
1. Откройте `/test-mood`
2. Введите `111111`
3. Нажмите "Открыть аналитику"

### Шаг 3: Откройте профиль
Перейдите на `/profile`

### Шаг 4: Проверьте логи в консоли

**Ожидаемые логи:**
```
🔍 [Profile] Loading data for userId: 111111
🔍 [Profile] maxUser: null
🔍 [Profile] debugUserId: 111111
✅ [Profile] Applying filter for tasks: user_id.eq.111111 OR user_id.is.null
📊 [Profile] Loaded X tasks
✅ [Profile] Applying filter for completed_tasks
📊 [Profile] Loaded Y completed tasks
✅ [Profile] Applying filter for daily_stats
📊 [Profile] Loaded Z daily stats
✅ [Profile] Data loading completed
```

## Возможные проблемы и решения:

### ❌ Проблема 1: userId = undefined/null
```
⚠️ [Profile] No userId - loading ALL tasks
```

**Причина:** `debugUserId` не установлен в localStorage

**Решение:**
```javascript
// В консоли браузера:
localStorage.setItem('debug_user_id', '111111');
location.reload();
```

### ❌ Проблема 2: Фильтр применяется, но все равно все задачи
```
✅ [Profile] Applying filter for tasks
📊 [Profile] Loaded 50 tasks  // Слишком много!
```

**Причина 1:** Все задачи в БД имеют `user_id = NULL`

**Проверка:**
```sql
SELECT user_id, COUNT(*) 
FROM tasks 
GROUP BY user_id;
```

**Решение:** Выполните миграции для добавления `user_id`:
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE completed_tasks ADD COLUMN IF NOT EXISTS user_id BIGINT;
ALTER TABLE daily_stats ADD COLUMN IF NOT EXISTS user_id BIGINT;
```

**Причина 2:** Задачи создаются без `user_id`

**Проверка:** Создайте новую задачу и проверьте в БД:
```sql
SELECT id, title, user_id, created_at 
FROM tasks 
ORDER BY created_at DESC 
LIMIT 1;
```

Если `user_id = NULL` → проблема в TasksService

### ❌ Проблема 3: useEffect не срабатывает
```
// Логов вообще нет
```

**Причина:** `useEffect` не перезапускается при изменении `debugUserId`

**Проверка в консоли:**
```javascript
// Проверьте значение:
localStorage.getItem('debug_user_id')

// Должно быть: "111111"
// Если null - установите и перезагрузите
```

**Решение:** Перезагрузите страницу после установки user_id

## Тестовый сценарий:

### Создайте тестовые данные для двух пользователей:

```sql
-- Пользователь 111111
INSERT INTO tasks (title, user_id, completed, created_at) VALUES
('Задача A1', 111111, false, NOW()),
('Задача A2', 111111, false, NOW());

INSERT INTO completed_tasks (title, user_id, completed_at) VALUES
('Выполнено A1', 111111, NOW());

INSERT INTO daily_stats (date, tasks_completed, goal, user_id) VALUES
(CURRENT_DATE, 1, 5, 111111);

-- Пользователь 222222
INSERT INTO tasks (title, user_id, completed, created_at) VALUES
('Задача B1', 222222, false, NOW()),
('Задача B2', 222222, false, NOW());

INSERT INTO completed_tasks (title, user_id, completed_at) VALUES
('Выполнено B1', 222222, NOW());

INSERT INTO daily_stats (date, tasks_completed, goal, user_id) VALUES
(CURRENT_DATE, 1, 5, 222222);
```

### Проверьте изоляцию:

**Окно 1 (user_id = 111111):**
```
📊 Loaded 2 tasks       // Только A1, A2
📊 Loaded 1 completed   // Только Выполнено A1
📊 Loaded 1 daily stats
```

**Окно 2 (user_id = 222222):**
```
📊 Loaded 2 tasks       // Только B1, B2
📊 Loaded 1 completed   // Только Выполнено B1
📊 Loaded 1 daily stats
```

## Проверка запросов к БД:

Откройте Network → выберите запрос к Supabase:

**Правильный запрос:**
```
GET /rest/v1/tasks?select=*&or=(user_id.eq.111111,user_id.is.null)&order=created_at.desc
```

**Неправильный запрос (без фильтра):**
```
GET /rest/v1/tasks?select=*&order=created_at.desc
```

## Дальнейшие действия:

1. **Откройте `/profile` с открытой консолью F12**
2. **Проверьте логи** - есть ли фильтрация?
3. **Проверьте Network** - применяется ли фильтр в URL?
4. **Проверьте БД** - есть ли `user_id` в таблицах?
5. **Отправьте мне логи** из консоли для диагностики

## Ожидаемый результат:

После всех проверок:
- ✅ В логах видно: `userId: 111111`
- ✅ Применяется фильтр: `Applying filter for tasks`
- ✅ Загружаются только задачи пользователя
- ✅ Разделы "Обзор" и "Аналитика" показывают правильную статистику

