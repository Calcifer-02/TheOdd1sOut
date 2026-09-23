/**
 * Публичный вход сущности «полигон». Подключаться к внутренним путям слайса
 * запрещено: граница держится проверкой, а не договорённостью (PRACT-012).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
export { StatusBadge, badgeStatus, type BadgeStatus } from './ui/StatusBadge';
export { OptionCard } from './ui/OptionCard';
