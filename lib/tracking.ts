/**
 * Format a manuscript's display tracking number.
 *
 * Tracking numbers follow the ScholarOne convention:
 *   ACRONYM-YYYY-NNNN          (original submission)
 *   ACRONYM-YYYY-NNNN.R{n}     (revision n, n >= 1)
 */
export function formatTrackingNumber(
  trackingNumber: string | null | undefined,
  revisionNumber: number | null | undefined
): string {
  if (!trackingNumber) return ""
  const rev = revisionNumber ?? 0
  return rev > 0 ? `${trackingNumber}.R${rev}` : trackingNumber
}
