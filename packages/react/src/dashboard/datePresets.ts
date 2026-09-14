/**
 * Relative date preset resolution.
 *
 * Mirrors the backend's `prismiq.dates.resolve_date_preset` so query-builder
 * widgets (whose filters are built client-side) and raw-SQL widgets (resolved
 * server-side) produce the same window for the same preset.
 */

/** Human-readable labels for relative date presets. */
export const DATE_PRESET_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7_days: 'Last 7 Days',
  last_30_days: 'Last 30 Days',
  this_week: 'This Week',
  last_week: 'Last Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  last_quarter: 'Last Quarter',
  this_year: 'This Year',
  last_year: 'Last Year',
  all_time: 'All Time',
};

/** ISO (YYYY-MM-DD) string for a date, in local time. */
function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Shift a date by whole months/days, clamping to month end. */
function addMonths(d: Date, months: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + months, d.getDate());
}

/** First day of the fiscal year containing `ref` (fyStart is 1-12). */
function fiscalYearStart(ref: Date, fyStart: number): Date {
  const month = ref.getMonth() + 1;
  const year = month >= fyStart ? ref.getFullYear() : ref.getFullYear() - 1;
  return new Date(year, fyStart - 1, 1);
}

/** First day of the fiscal quarter containing `ref`. */
function fiscalQuarterStart(ref: Date, fyStart: number): Date {
  const monthsIntoFy = ((ref.getMonth() + 1 - fyStart) % 12 + 12) % 12;
  return addMonths(fiscalYearStart(ref, fyStart), Math.floor(monthsIntoFy / 3) * 3);
}

/** Last day of the quarter beginning at `start`. */
function quarterEnd(start: Date): Date {
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

/**
 * Resolve a relative date preset to a concrete {start, end} ISO range.
 *
 * Quarter and year presets resolve against the tenant's fiscal calendar;
 * `fiscalYearStartMonth` of 1 yields calendar periods.
 *
 * @returns The resolved range, or null when the preset is unknown.
 */
export function resolveDatePreset(
  preset: string,
  fiscalYearStartMonth = 1,
  reference?: Date
): { start: string; end: string } | null {
  const ref = reference ?? new Date();
  const fyStart =
    Number.isInteger(fiscalYearStartMonth) &&
    fiscalYearStartMonth >= 1 &&
    fiscalYearStartMonth <= 12
      ? fiscalYearStartMonth
      : 1;

  const day = (offset: number): Date =>
    new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + offset);

  switch (preset) {
    case 'today':
      return { start: iso(ref), end: iso(ref) };
    case 'yesterday': {
      const y = day(-1);
      return { start: iso(y), end: iso(y) };
    }
    case 'last_7_days':
      return { start: iso(day(-6)), end: iso(ref) };
    case 'last_30_days':
      return { start: iso(day(-29)), end: iso(ref) };
    case 'this_week':
      // Week starts Monday, matching the backend.
      return { start: iso(day(-((ref.getDay() + 6) % 7))), end: iso(ref) };
    case 'last_week': {
      const thisWeekStart = day(-((ref.getDay() + 6) % 7));
      const lastWeekStart = new Date(
        thisWeekStart.getFullYear(),
        thisWeekStart.getMonth(),
        thisWeekStart.getDate() - 7
      );
      const lastWeekEnd = new Date(
        thisWeekStart.getFullYear(),
        thisWeekStart.getMonth(),
        thisWeekStart.getDate() - 1
      );
      return { start: iso(lastWeekStart), end: iso(lastWeekEnd) };
    }
    case 'this_month':
      return { start: iso(new Date(ref.getFullYear(), ref.getMonth(), 1)), end: iso(ref) };
    case 'last_month': {
      const start = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
      const end = new Date(ref.getFullYear(), ref.getMonth(), 0);
      return { start: iso(start), end: iso(end) };
    }
    case 'this_quarter': {
      const start = fiscalQuarterStart(ref, fyStart);
      return { start: iso(start), end: iso(quarterEnd(start)) };
    }
    case 'last_quarter': {
      const start = addMonths(fiscalQuarterStart(ref, fyStart), -3);
      return { start: iso(start), end: iso(quarterEnd(start)) };
    }
    case 'this_year': {
      const start = fiscalYearStart(ref, fyStart);
      const end = new Date(start.getFullYear() + 1, start.getMonth(), 0);
      return { start: iso(start), end: iso(end) };
    }
    case 'last_year': {
      const thisStart = fiscalYearStart(ref, fyStart);
      const start = new Date(thisStart.getFullYear() - 1, thisStart.getMonth(), 1);
      const end = new Date(thisStart.getFullYear(), thisStart.getMonth(), 0);
      return { start: iso(start), end: iso(end) };
    }
    case 'all_time':
      return { start: '1970-01-01', end: iso(ref) };
    default:
      return null;
  }
}
