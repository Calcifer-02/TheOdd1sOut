/**
 * Формы данных договора API: то, что расчётная часть присылает и принимает.
 *
 * Модуль объявлений: поведения здесь нет, поэтому якорь файловый. Формы
 * списаны со схем `src/back/Imolt.Api/contracts/openapi.yaml` — интерфейс не
 * заводит своей модели расчёта (ADR-0008, инвариант 2).
 *
 * @shared: imolt-miniapp
 * @adr: ADR-0008
 */
import type { Money, Unit } from '@/shared/lib/formatting';
import type { DistanceMode, SortField, SortOrder } from '@/shared/lib/viewState';

export type { SortField, SortOrder, DistanceMode };

export type Coordinates = { latitude: number; longitude: number };

export type ServiceArea = 'moscow' | 'moscowRegion';

export type AddressSuggestion = {
  id: string;
  value: string;
  coordinates: Coordinates;
  area: ServiceArea;
};

export type WasteGroup = {
  id: string;
  name: string;
  fkkoCodes: string[];
  transportPricePerTonKm: Money;
  densityTonPerCubicMeter: number;
  updatedAt: string;
};

export type LandfillStatus = 'active' | 'blocked' | 'unconfirmed';

export type PlacementOption = {
  landfillId: string;
  landfillName: string;
  address: string;
  distanceKm: number;
  transportCost: Money;
  disposalCost?: Money | null;
  totalCost: Money;
  status: LandfillStatus;
  statusUpdatedAt: string;
};

export type EmptyReason = 'noLandfillsForWasteGroup' | 'filteredOutByDistance' | null;

export type PlacementOptionPage = {
  items: PlacementOption[];
  total: number;
  limit: number;
  offset: number;
  emptyReason?: EmptyReason;
};

export type Quantity = { value: number; unit: Unit };

export type CalculationItem = {
  wasteGroupId: string;
  wasteGroupName: string;
  input: Quantity;
  /** Объём в мере расчёта: с введённым совпадает, только если меры совпали. */
  calculated: Quantity;
  tons: number;
};

export type DataFreshness = {
  pricesUpdatedAt: string;
  statusesUpdatedAt: string;
  landfillsWithStaleData?: number;
};

export type SelectionEntry = { wasteGroupId: string; landfillId: string };

export type SelectionWarning = {
  code: 'landfillBlocked' | 'landfillDataStale';
  landfillId: string;
  message: string;
};

export type SelectionState = {
  entries: SelectionEntry[];
  selectedLandfills: number;
  total: Money;
  warnings: SelectionWarning[];
};

export type AllocationEntry = {
  wasteGroupId: string;
  landfillId: string;
  quantity: Quantity;
};

export type AllocationPricedEntry = AllocationEntry & {
  transportCost: Money;
  disposalCost?: Money | null;
  totalCost: Money;
};

export type AllocationState = {
  entries: AllocationPricedEntry[];
  total: Money;
};

export type PickupAddress = {
  suggestionId?: string;
  value: string;
  coordinates: Coordinates;
  area?: ServiceArea;
};

export type Calculation = {
  id: string;
  createdAt: string;
  preliminary: boolean;
  pickupAddress: PickupAddress;
  /** Мера расчёта по зоне адреса вывоза: «t» по Москве, «m3» по области. */
  measure: Unit;
  disposalRequired: boolean;
  distanceFilter?: { mode: DistanceMode; km: number };
  items: CalculationItem[];
  results: { wasteGroupId: string; options: PlacementOptionPage }[];
  selection?: SelectionState;
  allocation?: AllocationState;
  dataFreshness: DataFreshness;
};

export type Access = {
  granted: boolean;
  reason?: 'subscriptionRequired' | 'authenticationRequired' | null;
};

export type RouteLeg = {
  landfillId: string;
  distanceKm: number;
  durationMinutes?: number | null;
  externalMapUrl?: string | null;
  encumbrances?: { kind: string; title: string }[];
};

export type RouteSummary = { access: Access; legs: RouteLeg[]; total: Money };

export type Quote = {
  id: string;
  number: string;
  issuedAt: string;
  validUntil: string;
  total: Money;
  preliminary: boolean;
  documentUrl: string;
};

export type PickupRequestInput = {
  calculationId?: string;
  landfillId?: string;
  contactName: string;
  phone: string;
  personalDataConsent: boolean;
};

export type PickupRequest = {
  id: string;
  createdAt: string;
  state: 'accepted';
  message?: string;
};

export type Page<T> = { items: T[]; total: number; limit: number; offset: number };

export type CalculationRequest = {
  pickupAddress: PickupAddress;
  items: { wasteGroupId: string; quantity: Quantity }[];
  disposalRequired: boolean;
  distanceFilter: { mode: DistanceMode; km: number };
};

export type AmountConversionItem = {
  wasteGroupId: string;
  input: Quantity;
  tons: number;
  cubicMeters: number;
  densityTonPerCubicMeter: number;
};

export type SubscriptionState = 'none' | 'pending' | 'active';

/**
 * Состояние подписки, как его отдаёт договор: не строка, а запись с датой
 * окончания. Зеркало договора держало здесь строку, и сравнение
 * `profile.subscription === 'active'` молча давало ложь на любом участнике с
 * действующей подпиской.
 */
export type SubscriptionStanding = {
  state: SubscriptionState;
  activeUntil?: string | null;
};

export type Profile = {
  id: string;
  maxUserId: string;
  displayName?: string | null;
  role?: 'carrier' | 'demolitionCompany' | null;
  companyName?: string | null;
  inn?: string | null;
  phone?: string | null;
  registeredInAisOssig?: boolean | null;
  hasTransportLicense?: boolean | null;
  hasSanitaryConclusion?: boolean | null;
  subscription: SubscriptionStanding;
};

export type Session = { accessToken: string; expiresIn: number; profile: Profile };

export type SessionRequest = { initData: string; personalDataConsent: boolean };
