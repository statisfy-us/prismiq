/**
 * Date preset definitions for smart date filtering.
 */

export const DATE_RELATIVE_INFINITY_DAYS = 1826; // ~5 years

export interface DatePreset {
  /** Unique key for the preset. */
  key: string;
  /** Display label. */
  label: string;
  /** Backend filter operator. */
  operator: 'date_relative' | 'not_date_relative' | 'date_window';
  /** Default value sent to the backend. */
  defaultValue: number | { period: string; value: number };
  /** Whether the user needs to specify a number of days. */
  requiresDaysInput?: boolean;
}

/**
 * Get the fiscal quarter number (1-4) for a given date and fiscal year start month.
 */
function getFiscalQuarter(d: Date, fiscalYearStartMonth: number): number {
  const month = d.getMonth() + 1; // 1-indexed
  let monthsIntoFY: number;
  if (month >= fiscalYearStartMonth) {
    monthsIntoFY = month - fiscalYearStartMonth;
  } else {
    monthsIntoFY = month + 12 - fiscalYearStartMonth;
  }
  return Math.floor(monthsIntoFY / 3) + 1; // 1-based quarter
}

/**
 * Get the absolute quarter number (1-4) for a relative offset from the current quarter.
 */
function getQuarterForOffset(
  currentFQ: number,
  offset: number,
): number {
  // Normalize to 0-based, apply offset, wrap around to 1-4
  let q = ((currentFQ - 1 + offset) % 4);
  if (q < 0) q += 4;
  return q + 1;
}

/**
 * Build the list of date presets.
 *
 * @param fiscalYearStartMonth - Month (1-12) when the fiscal year starts. Defaults to 1 (January).
 */
export function getDatePresets(fiscalYearStartMonth: number = 1): DatePreset[] {
  const now = new Date();
  const currentFQ = getFiscalQuarter(now, fiscalYearStartMonth);

  return [
    // Relative date presets
    {
      key: 'before_today',
      label: 'Before today',
      operator: 'date_relative',
      defaultValue: -DATE_RELATIVE_INFINITY_DAYS,
    },
    {
      key: 'after_today',
      label: 'After today',
      operator: 'date_relative',
      defaultValue: DATE_RELATIVE_INFINITY_DAYS,
    },
    {
      key: 'in_next_x_days',
      label: 'In Next X days',
      operator: 'date_relative',
      defaultValue: 30,
      requiresDaysInput: true,
    },
    {
      key: 'in_last_x_days',
      label: 'In Last X days',
      operator: 'date_relative',
      defaultValue: -30,
      requiresDaysInput: true,
    },
    {
      key: 'not_in_last_x_days',
      label: 'Not in Last X days',
      operator: 'not_date_relative',
      defaultValue: -30,
      requiresDaysInput: true,
    },
    {
      key: 'not_in_next_x_days',
      label: 'Not in Next X days',
      operator: 'not_date_relative',
      defaultValue: 30,
      requiresDaysInput: true,
    },

    // Fiscal quarter presets (offsets -4 through +2 from current quarter)
    {
      key: 'prev_fq4',
      label: `In Previous Fiscal Quarter (FQ${getQuarterForOffset(currentFQ, -4)})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: -4 },
    },
    {
      key: 'prev_fq3',
      label: `In Previous Fiscal Quarter (FQ${getQuarterForOffset(currentFQ, -3)})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: -3 },
    },
    {
      key: 'prev_fq2',
      label: `In Previous Fiscal Quarter (FQ${getQuarterForOffset(currentFQ, -2)})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: -2 },
    },
    {
      key: 'prev_fq1',
      label: `In Previous Fiscal Quarter (FQ${getQuarterForOffset(currentFQ, -1)})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: -1 },
    },
    {
      key: 'curr_fq',
      label: `In Current Fiscal Quarter (FQ${currentFQ})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: 0 },
    },
    {
      key: 'next_fq2',
      label: `In Next Fiscal Quarter (FQ${getQuarterForOffset(currentFQ, 1)})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: 1 },
    },
    {
      key: 'next_fq3',
      label: `In Next Fiscal Quarter (FQ${getQuarterForOffset(currentFQ, 2)})`,
      operator: 'date_window',
      defaultValue: { period: 'quarterly', value: 2 },
    },

    // Fiscal year presets
    {
      key: 'prev_fy',
      label: 'In Previous Fiscal Year',
      operator: 'date_window',
      defaultValue: { period: 'yearly', value: -1 },
    },
    {
      key: 'curr_fy',
      label: 'In Current Fiscal Year (YTD)',
      operator: 'date_window',
      defaultValue: { period: 'yearly', value: 0 },
    },
    {
      key: 'next_fy',
      label: 'In Next Fiscal Year',
      operator: 'date_window',
      defaultValue: { period: 'yearly', value: 1 },
    },
  ];
}

/**
 * Find the matching preset for a given filter operator and value.
 * Returns the preset key or null if no match.
 */
export function findPresetKey(
  operator: string,
  value: unknown,
  fiscalYearStartMonth: number = 1,
): string | null {
  const presets = getDatePresets(fiscalYearStartMonth);

  for (const preset of presets) {
    if (preset.operator !== operator) continue;

    if (preset.requiresDaysInput) {
      // For variable-day presets, match by operator and sign of value
      if (typeof value !== 'number') continue;
      const defaultVal = preset.defaultValue as number;
      // Match if same sign (both positive or both negative)
      if ((defaultVal > 0 && value > 0) || (defaultVal < 0 && value < 0)) {
        // Distinguish date_relative vs not_date_relative presets
        // For date_relative: positive=next_x_days, negative=last_x_days
        // For not_date_relative: positive=not_in_next_x_days, negative=not_in_last_x_days
        return preset.key;
      }
    } else if (operator === 'date_window') {
      // Match by exact value (period + offset)
      if (
        typeof value === 'object' &&
        value !== null &&
        typeof preset.defaultValue === 'object'
      ) {
        const v = value as { period: string; value: number };
        const d = preset.defaultValue;
        if (v.period === d.period && v.value === d.value) {
          return preset.key;
        }
      }
    } else {
      // Fixed presets (before_today, after_today) - match by exact value
      if (value === preset.defaultValue) {
        return preset.key;
      }
    }
  }

  return null;
}
