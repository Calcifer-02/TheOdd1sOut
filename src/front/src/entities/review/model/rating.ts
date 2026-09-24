/**
 * Границы оценки полигона и её словесное значение.
 *
 * Оценка относится к достоверности сведений о полигоне, а не к качеству
 * услуги (R-031): словарь подписей именно об этом. Границы 1..5 заданы
 * договором (схема `LandfillReviewInput`), второго места их объявления нет.
 *
 * @supports: R-031
 * @adr: ADR-0008
 */

/** Наименьшая допустимая оценка договора. */
export const MIN_RATING = 1;

/** Наибольшая допустимая оценка договора. */
export const MAX_RATING = 5;

/** Варианты оценки для выбора. Строки — значение переключателя в разметке. */
export const RATING_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: MAX_RATING - MIN_RATING + 1 },
  (_, index) => {
    const rating = MIN_RATING + index;
    return { value: String(rating), label: String(rating) };
  },
);

/**
 * Подпись шкалы: без неё цифра ничего не сообщает, а угадывать её направление
 * пользователь не обязан.
 */
export const RATING_SCALE_HINT = `${MIN_RATING} – сведения не сошлись, ${MAX_RATING} – сведения верны`;
