/**
 * Публичный вход сущности «полигон». Подключаться к внутренним путям слайса
 * запрещено: граница держится проверкой, а не договорённостью (PRACT-012).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
export { StatusBadge, badgeStatus, STATUS_WORD, type BadgeStatus } from './ui/StatusBadge';
export { STALE_AFTER_DAYS, daysBehind, isStale } from './model/staleness';
export { OptionCard } from './ui/OptionCard';
export { OptionTable } from './ui/OptionTable';
export { RouteDetails } from './ui/RouteDetails';
export { RouteModal } from './ui/RouteModal';
export { routeRows, type RouteRow, type RouteScope } from './model/routeSummary';
