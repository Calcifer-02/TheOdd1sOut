/**
 * Оформление представления компании на базовой странице.
 *
 * Разделы стоят одной колонкой, а число колонок внутри раздела меняется
 * правилом стиля: перечень услуг и перечень проектов — сетка, и на телефоне
 * она становится одноколоночной без второго дерева разметки (R-085, R-087).
 *
 * @supports: R-087
 */
import { BREAKPOINTS } from '@/shared/lib/viewport';
import { colors, fonts, radius, space, stroke } from '@/shared/ui/tokens';

export const COMPANY_CSS = `
.imolt-company {
  display: flex;
  flex-direction: column;
  gap: ${space.xl}px;
  /* Отбивка от расчёта крупнее, чем между разделами внутри: представление
     компании начинается там, где заканчивается работа с формой. */
  margin-top: ${space.xxl}px;
}

.imolt-company-block { display: flex; flex-direction: column; gap: ${space.m}px; }

.imolt-company-services,
.imolt-company-projects,
.imolt-company-contacts {
  display: grid;
  gap: ${space.s}px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.imolt-company-services { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.imolt-company-projects { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.imolt-company-contacts { grid-template-columns: repeat(2, minmax(0, 1fr)); }

/* Логотипы клиентов: пять в ряд, как на сайте компании. Высота одна на все,
   а картинка вписывается целиком: у пятнадцати чужих логотипов разные
   пропорции, и без общей меры ряд разъезжается. */
/* Лента клиентов: одна строка вместо трёх рядов плиток. Ряд едет влево на
   свою ширину, второй такой же ряд подхватывает — и движение замыкается без
   рывка. Останавливается на наведении и на фокусе внутри: читать логотип на
   ходу нельзя. */
.imolt-company-clients-track {
  display: flex;
  gap: ${space.m}px;
  overflow: hidden;
}

.imolt-company-clients-track:hover .imolt-company-clients,
.imolt-company-clients-track:focus-within .imolt-company-clients {
  animation-play-state: paused;
}

.imolt-company-clients {
  display: flex;
  flex: 0 0 auto;
  gap: ${space.m}px;
  margin: 0;
  padding: 0;
  list-style: none;
  animation: imolt-company-clients-run 40s linear infinite;
}

.imolt-company-client { flex: 0 0 ${space.xxxl * 4}px; }

@keyframes imolt-company-clients-run {
  from { transform: translateX(0); }
  to { transform: translateX(calc(-100% - ${space.m}px)); }
}

/* Движение — украшение: при выключенном движении в системе лента стоит, а
   прокрутка остаётся пальцем и колесом. */
@media (prefers-reduced-motion: reduce) {
  .imolt-company-clients { animation: none; }
  .imolt-company-clients-track { overflow-x: auto; }
}

.imolt-company-client {
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${colors.bgSurface};
  border-radius: ${radius.field}px;
  padding: ${space.m}px;
  min-height: ${space.xxxl * 2}px;
}

.imolt-company-logo { max-width: 100%; max-height: ${space.xxxl}px; object-fit: contain; }

/* Снимок проекта занимает всю ширину карточки и постоянную высоту: у чужих
   фотографий разные пропорции, и без общей меры ряд карточек разъезжается. */
.imolt-company-photo {
  width: 100%;
  height: ${space.xxxl * 2}px;
  object-fit: cover;
  border-radius: ${radius.field}px;
  margin-bottom: ${space.xs}px;
}

.imolt-company-service,
.imolt-company-project,
.imolt-company-contact {
  display: flex;
  flex-direction: column;
  gap: ${space.xxs}px;
  background: ${colors.bgSurface};
  border-radius: ${radius.card}px;
  padding: ${space.l}px;
}

/* Цена — число, и разряды в нём стоят столбиком: в пропорциональной гарнитуре
   соседние цены разъезжаются по ширине (разд. 4.2). */
.imolt-company-price,
.imolt-company-amount {
  font-family: ${fonts.numeric};
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: ${colors.textPrimary};
}

.imolt-company-source {
  margin: 0;
  font-family: ${fonts.ui};
  font-size: 13px;
  line-height: 18px;
  color: ${colors.textSecondary};
  border-top: ${stroke.hairline}px solid ${colors.borderDivider};
  padding-top: ${space.s}px;
}

@media (max-width: ${BREAKPOINTS.sideSummary - 1}px) {
  .imolt-company-services { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .imolt-company-projects { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: ${BREAKPOINTS.cards - 1}px) {
  .imolt-company { margin-top: ${space.xl}px; gap: ${space.l}px; }
  .imolt-company-services,
  .imolt-company-projects,
  .imolt-company-contacts { grid-template-columns: minmax(0, 1fr); }

  /* На телефоне плитка клиента уже: иначе в ленту помещается полторы штуки и
     движение читается рывком. */
  .imolt-company-client { flex-basis: ${space.xxxl * 3}px; }
}
`;
