/**
 * Запуск squawk для линтера кода TRIP.
 *
 * Средство умеет находить пакет `squawk-cli` само, но ищет его от корня
 * проверки вверх по `node_modules`, а своего `package.json` в корне
 * репозитория у проекта нет: зависимости узла объявлены в мини-приложении.
 * Поэтому команда названа в `.trip-lint.toml` явно, а средство передаёт ей
 * настройку, перечень миграций и дополнительные ключи переменными окружения —
 * дописывать их к команде оно не станет.
 *
 * Собственных правил здесь нет: настройка squawk принадлежит средству, и
 * второй её редакции в проекте быть не должно.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const config = process.env.TRIP_LINT_SQUAWK_CONFIG ?? '';
const files = (process.env.TRIP_LINT_SQUAWK_FILES ?? '').split('\n').filter((line) => line !== '');
const extra = (process.env.TRIP_LINT_SQUAWK_ARGS ?? '').split(' ').filter((word) => word !== '');

// Пустой перечень миграций — не повод звать squawk: без файлов он отвечает
// строкой «Found 0 issues», а средство ждёт JSON и объявляет движок
// непроверенным.
if (files.length === 0) {
  process.stdout.write('[]');
  process.exit(0);
}

const script = require.resolve('squawk-cli/js/bin/squawk', {
  paths: [new URL('../src/front', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1')],
});

const outcome = spawnSync(
  process.execPath,
  [script, '--reporter', 'json', '--config', config, ...extra, ...files],
  { encoding: 'utf8' },
);

process.stdout.write(outcome.stdout ?? '');
process.stderr.write(outcome.stderr ?? '');
process.exit(outcome.status ?? 1);
