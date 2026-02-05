/**
 * Date formatting utilities for converting .NET format strings to JavaScript date formatters.
 *
 * Supports common .NET date format patterns.
 */

/**
 * Convert .NET date format string to JavaScript date formatter.
 *
 * Common patterns:
 * - dd-MMM-yyyy HH:mm -> 20-Mar-2025 17:00
 * - yyyy-MM-dd -> 2025-03-20
 * - MM/dd/yyyy -> 03/20/2025
 * - yyyy-MM-dd HH:mm:ss -> 2025-03-20 17:00:00
 *
 * @param formatString .NET date format string
 * @returns Formatter function
 */
export function createDateFormatter(formatString: string): (value: unknown) => string {
  return (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }

    // Parse date from various formats
    let date: Date;
    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else {
      return String(value);
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return String(value);
    }

    // Convert .NET format to formatted string
    return formatDateWithPattern(date, formatString);
  };
}

/**
 * Format date according to .NET format pattern.
 */
function formatDateWithPattern(date: Date, pattern: string): string {
  // Get date components
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();

  // Month names
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Day names
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Quarter (1-4)
  const quarter = Math.ceil(month / 3);

  // Replace tokens
  let result = pattern;

  // Quarter - use placeholder to avoid the single-Q pass reprocessing the Q inserted by QQ
  result = result.replace(/QQ/g, '__QUARTER_PLACEHOLDER__');
  result = result.replace(/Q(?!['"])/g, String(quarter));
  result = result.replace(/__QUARTER_PLACEHOLDER__/g, `Q${quarter}`);

  // Year
  result = result.replace(/yyyy/g, String(year).padStart(4, '0'));
  result = result.replace(/yy/g, String(year % 100).padStart(2, '0'));

  // Month - use placeholders without pattern letters to avoid subsequent replacements
  // Using «» brackets which won't appear in date format patterns
  result = result.replace(/MMMM/g, '«1»');
  result = result.replace(/MMM/g, '«2»');
  result = result.replace(/MM/g, String(month).padStart(2, '0'));
  result = result.replace(/M/g, String(month));

  // Day - use placeholders for day names
  result = result.replace(/dddd/g, '«3»');
  result = result.replace(/ddd/g, '«4»');
  result = result.replace(/dd/g, String(day).padStart(2, '0'));
  result = result.replace(/d/g, String(day));

  // Replace month/day name placeholders at the end (after all pattern matching is done)
  result = result.replace(/«1»/g, monthNamesFull[month - 1] || '');
  result = result.replace(/«2»/g, monthNamesShort[month - 1] || '');
  result = result.replace(/«3»/g, dayNamesFull[date.getDay()] || '');
  result = result.replace(/«4»/g, dayNamesShort[date.getDay()] || '');

  // Hours (24-hour)
  result = result.replace(/HH/g, String(hours).padStart(2, '0'));
  result = result.replace(/H/g, String(hours));

  // Hours (12-hour)
  const hours12 = hours % 12 || 12;
  result = result.replace(/hh/g, String(hours12).padStart(2, '0'));
  result = result.replace(/h/g, String(hours12));

  // AM/PM
  const ampm = hours >= 12 ? 'PM' : 'AM';
  result = result.replace(/tt/g, ampm);
  result = result.replace(/t/g, ampm.charAt(0));

  // Minutes
  result = result.replace(/mm/g, String(minutes).padStart(2, '0'));
  result = result.replace(/m/g, String(minutes));

  // Seconds
  result = result.replace(/ss/g, String(seconds).padStart(2, '0'));
  result = result.replace(/s/g, String(seconds));

  return result;
}

/**
 * Create date formatters from config map.
 *
 * @param dateFormats Map of column name to .NET format string
 * @returns Map of column name to formatter function
 */
export function createDateFormatters(
  dateFormats: Record<string, string>
): Record<string, (value: unknown) => string> {
  const formatters: Record<string, (value: unknown) => string> = {};

  for (const [column, format] of Object.entries(dateFormats)) {
    formatters[column] = createDateFormatter(format);
  }

  return formatters;
}

/**
 * Format a Unix timestamp as relative time (e.g., "5 min ago").
 *
 * @param timestamp Unix timestamp in seconds
 * @returns Relative time string
 */
export function formatRelativeTime(timestamp: number | null | undefined): string {
  if (timestamp === null || timestamp === undefined) {
    return 'Never';
  }

  const now = Date.now() / 1000; // Convert to seconds
  const seconds = Math.floor(now - timestamp);

  if (seconds < 60) {
    return 'Just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hr ago`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return '1 day ago';
  }

  return `${days} days ago`;
}
