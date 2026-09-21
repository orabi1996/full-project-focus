/**
 * Timezone-aware date utilities for leave management, calendars, and company-scoped operations.
 * Prevents browser-local date drift when companies operate across different regional timezones
 * (e.g. Cairo, Riyadh, Doha, Manama, Muscat).
 */

export const DEFAULT_TIMEZONE = 'UTC';

/**
 * Returns the current date in YYYY-MM-DD format within the specified timezone.
 */
export function getCompanyToday(timezone?: string): string {
  const tz = timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Returns the current year as a number within the specified timezone.
 */
export function getCompanyYear(timezone?: string): number {
  const today = getCompanyToday(timezone);
  return parseInt(today.split('-')[0], 10);
}

/**
 * Returns the current month (1-12) as a number within the specified timezone.
 */
export function getCompanyMonth(timezone?: string): number {
  const today = getCompanyToday(timezone);
  return parseInt(today.split('-')[1], 10);
}

/**
 * Returns the start (YYYY-MM-01) and end date (YYYY-MM-DD) for a given month and year within the specified timezone.
 */
export function getCompanyMonthBoundaries(
  year: number,
  month: number, // 1 - 12
  timezone?: string
): { startDate: string; endDate: string } {
  const tz = timezone && isValidTimezone(timezone) ? timezone : DEFAULT_TIMEZONE;
  const paddedMonth = String(month).padStart(2, '0');
  const startDate = `${year}-${paddedMonth}-01`;

  // Calculate last day of the month
  // Month in JS Date is 0-indexed; passing month (1-12) as the next month's 0th day gives the last day of requested month.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate };
}

/**
 * Validates whether an IANA timezone string is supported by the runtime.
 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
