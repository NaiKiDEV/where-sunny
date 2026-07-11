import type { WindowId } from '../types';

export const TIME_WINDOWS: { id: WindowId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'weekend', label: 'Weekend' },
  { id: 'week', label: '7 days' },
];

const WEEK_LENGTH = 7;
const SATURDAY = 6;

export function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Local calendar dates (YYYY-MM-DD) covered by a time window. All dates fall
 * within the 7-day forecast horizon, so one forecast fetch serves every
 * window. "Weekend" means the upcoming Sat+Sun - or what's left of it: on
 * Saturday it's Sat+Sun, on Sunday just Sunday.
 */
export function windowDates(windowId: WindowId, now = new Date()): string[] {
  switch (windowId) {
    case 'today':
      return [toLocalIsoDate(now)];
    case 'tomorrow':
      return [toLocalIsoDate(addDays(now, 1))];
    case 'week':
      return Array.from({ length: WEEK_LENGTH }, (_, i) => toLocalIsoDate(addDays(now, i)));
    case 'weekend': {
      const dow = now.getDay();
      if (dow === 0) return [toLocalIsoDate(now)];
      const daysToSaturday = SATURDAY - dow;
      return [toLocalIsoDate(addDays(now, daysToSaturday)), toLocalIsoDate(addDays(now, daysToSaturday + 1))];
    }
  }
}
