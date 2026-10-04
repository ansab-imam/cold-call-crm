export function daysSince(iso: string): number {
  const date = new Date(iso);
  const today = new Date();
  return Math.floor(
    (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      86_400_000
  );
}

export function formatRelativeDate(iso: string): string {
  const diffDays = daysSince(iso);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

// A "next follow-up" date only ever comes from a plain <input type="date">
// (no time-of-day), stored as that calendar day's UTC midnight. Formatting
// or comparing it against the viewer's *local* clock can silently shift it
// a day in either direction depending on timezone — so every read of it
// stays in UTC terms throughout, matching how it was written.
export function formatDateOnly(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { timeZone: "UTC" });
}

export function daysUntil(iso: string, now: Date = new Date()): number {
  const d = new Date(iso);
  const dueUTC = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((dueUTC - todayUTC) / 86_400_000);
}

export function isDueOrOverdue(iso: string, now: Date = new Date()): boolean {
  return daysUntil(iso, now) <= 0;
}
