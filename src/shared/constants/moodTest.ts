export interface Question {
  id: number;
  text: string;
  subscale: 'stress' | 'coping';
  reverse: boolean;
}

export interface Option {
  value: number;
  label: string;
}

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'Как часто за последний месяц вы испытывали беспокойство из-за непредвиденных событий?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 2,
    text: 'Как часто за последний месяц Вам казалось сложным контролировать важные события Вашей жизни?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 3,
    text: 'Как часто за последний месяц Вы испытывали нервное напряжение или стресс?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 4,
    text: 'Как часто за последний месяц Вы чувствовали уверенность в том, что справитесь с решением ваших личных проблем?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 5,
    text: 'Как часто за последний месяц Вы чувствовали, что все идет так, как Вы этого хотели?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 6,
    text: 'Как часто за последний месяц Вы думали, что не можете с��равиться с тем, что вам нужно сделать?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 7,
    text: 'Как часто за последний месяц Вы были в состоянии справиться с вашей раздражительностью?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 8,
    text: 'Как часто за последний месяц Вы чувствовали, что владеете ситуацией?',
    subscale: 'coping',
    reverse: true
  },
  {
    id: 9,
    text: 'Как часто за последний месяц Вы чувствовали раздражение из-за того, что происходящие события выходили из-под вашего контроля?',
    subscale: 'stress',
    reverse: false
  },
  {
    id: 10,
    text: 'Как часто за последний месяц вам казалось, что накопившиеся трудности достигли такого предела, что Вы не могли их контролировать?',
    subscale: 'stress',
    reverse: false
  }
];

export const OPTIONS: Option[] = [
  { value: 1, label: 'Никогда' },
  { value: 2, label: 'Почти никогда' },
  { value: 3, label: 'Иногда' },
  { value: 4, label: 'Довольно часто' },
  { value: 5, label: 'Часто' }
];

