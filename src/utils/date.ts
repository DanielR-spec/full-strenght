/**
 * Safely parses a date string into a local Date object representing midnight on that calendar day,
 * preventing timezone shift issues.
 */
export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Match YYYY-MM-DD pattern at the beginning of the string (handles ISO strings and plain YYYY-MM-DD)
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]) - 1; // 0-indexed month
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Fallback for other formats
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  return null;
}

/**
 * Formats a date string into a localized human-readable string.
 * Returns the original string if parsing fails.
 */
export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  try {
    const date = parseLocalDate(dateStr);
    if (!date) return dateStr;
    return date.toLocaleDateString('en-US', options || {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}
