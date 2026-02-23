export const MIN_NET_BUDGET = 20000;
export const MIN_BUDGET = 25000;
export const MAX_BUDGET = 1000000;
export const MIN_DURATION = 5;
export const MAX_DURATION = 30;

export const BUDGET_BRACKETS = [
  { min: 100000, max: 1000000, commission: 10, reachMin: 20, reachMax: 35, likeMin: 0.06, likeMax: 0.09, shareMin: 0.015, shareMax: 0.022 },
  { min: 70000,  max: 99999,   commission: 12, reachMin: 15, reachMax: 28, likeMin: 0.05, likeMax: 0.08, shareMin: 0.012, shareMax: 0.018 },
  { min: 40000,  max: 69999,   commission: 15, reachMin: 12, reachMax: 22, likeMin: 0.05, likeMax: 0.07, shareMin: 0.01,  shareMax: 0.015 },
  { min: 25000,  max: 39999,   commission: 20, reachMin: 8,  reachMax: 15, likeMin: 0.04, likeMax: 0.06, shareMin: 0.008, shareMax: 0.012 },
];

export const TURKISH_MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const TURKISH_DAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

export const QUICK_DURATIONS = [5, 7, 14, 21, 30] as const;
