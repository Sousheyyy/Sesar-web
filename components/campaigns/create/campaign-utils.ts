import { BUDGET_BRACKETS, MIN_BUDGET } from "./campaign-constants";

export function getBracket(budget: number) {
  if (budget < MIN_BUDGET) return null;
  for (const b of BUDGET_BRACKETS) {
    if (budget >= b.min) return b;
  }
  return null;
}

export function getEstimates(budget: number, durationDays: number) {
  const bracket = getBracket(budget);
  if (!bracket) return null;
  const df = durationDays / 15;
  const minViews = Math.round(budget * bracket.reachMin * df);
  const maxViews = Math.round(budget * bracket.reachMax * df);
  return {
    minViews,
    maxViews,
    minLikes: Math.round(minViews * bracket.likeMin),
    maxLikes: Math.round(maxViews * bracket.likeMax),
    minShares: Math.round(minViews * bracket.shareMin),
    maxShares: Math.round(maxViews * bracket.shareMax),
  };
}

export function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDow = firstDay.getDay() - 1; // Monday-based week
  if (startDow < 0) startDow = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) days.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}
