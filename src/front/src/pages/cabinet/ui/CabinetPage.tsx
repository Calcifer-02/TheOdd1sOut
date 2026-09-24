/**
 * Экран кабинета: вход, подписка, сохранённые расчёты, услуги, профиль
 * (экраны Э-09 и Э-10).
 *
 * Своей аутентификации у сервиса нет: личность даёт платформа MAX
 * (ADR-0006). Экран, открытый не из переписки, сессии не получает — это
 * рабочее состояние, и кабинет показывает его честно, а не имитирует вход и
 * не показывает чужих данных (R-050).
 *
 * Модель вызывается здесь, а не внутри представлений: смена ширины окна
 * меняет разметку, но не должна ни сбрасывать набранное, ни перезапрашивать
 * загруженное.
 *
 * @req: R-049
 * @supports: R-008, R-050, R-051, R-052, R-054
 * @adr: ADR-0006
 */
import { Notice, Skeleton, useStyles } from '@/shared/ui';
import { isWide, useViewport } from '@/shared/lib/viewport';
import { useParticipant } from '@/entities/participant';
import { useCabinetSection, useCalculations, useDocumentServices, useProfile, useServiceOrder } from '../model/cabinet';
import { CabinetDesktop } from './CabinetDesktop';
import { CabinetMobile } from './CabinetMobile';
import type { CabinetView } from './CabinetSections';
import { SignInDesktop } from './SignInDesktop';
import { SignInMobile } from './SignInMobile';
import { CABINET_CSS } from './styles';

export function CabinetPage() {
  useStyles('cabinet', CABINET_CSS);

  const session = useParticipant();
  const identified = session !== null;
  const { section, openSection } = useCabinetSection();
  const wide = isWide(useViewport());

  const profileState = useProfile(identified);
  // Раздел грузит своё и только когда открыт: кабинет не тянет каталог услуг
  // ради списка расчётов.
  const calculations = useCalculations(identified && section === 'calculations');
  const services = useDocumentServices(identified && section === 'services');
  const order = useServiceOrder();

  // Вход показывается тем же правилом, что и сам кабинет: у состояния «участник
  // не опознан» два представления, и на широком окне это рабочее место, а не
  // колонка телефона (R-085, AC-085a).
  if (!identified) {
    return wide ? <SignInDesktop /> : <SignInMobile />;
  }

  if (profileState.failure !== null) {
    return (
      <div className="imolt-cabinet">
        <Notice kind="error">{profileState.failure}</Notice>
      </div>
    );
  }

  if (profileState.profile === null) {
    return (
      <div className="imolt-cabinet">
        <Skeleton rows={3} label="Кабинет загружается" />
      </div>
    );
  }

  const view: CabinetView = {
    section,
    openSection,
    profile: profileState.profile,
    calculations,
    services,
    order,
    applySubscription: profileState.applySubscription,
    wide,
  };

  return wide ? <CabinetDesktop view={view} /> : <CabinetMobile view={view} />;
}
