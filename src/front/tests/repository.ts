// Корень репозитория ищется по файлу trip.json — так же, как в проверках
// расчётной части: проверка не зависит от того, из какой папки её запустили.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function repositoryRoot(): string {
  let directory = dirname(fileURLToPath(import.meta.url));

  while (!existsSync(join(directory, 'trip.json'))) {
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error('Корень репозитория не найден: рядом нет trip.json');
    }
    directory = parent;
  }

  return directory;
}

export const miniappSource = join(repositoryRoot(), 'src', 'front', 'src');

export const contractPath = join(
  repositoryRoot(),
  'src',
  'back',
  'Imolt.Api',
  'contracts',
  'openapi.yaml',
);

/** Исходные файлы мини-приложения с путём относительно корня репозитория. */
export function sourceFiles(root: string = miniappSource): { path: string; text: string }[] {
  const found: { path: string; text: string }[] = [];

  for (const entry of readdirSync(root)) {
    const full = join(root, entry);

    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
      continue;
    }

    if (/\.(ts|tsx|css|html)$/.test(entry)) {
      found.push({
        path: relative(repositoryRoot(), full).replaceAll('\\', '/'),
        text: readFileSync(full, 'utf8'),
      });
    }
  }

  return found;
}
