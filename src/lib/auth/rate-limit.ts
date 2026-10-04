import "server-only";

// A simple in-memory sliding window. Not shared across serverless instances,
// so it's a speed bump against casual brute-forcing rather than a hard
// guarantee — enough for this app's scale (a small internal sales team), not
// meant to replace a real distributed limiter if this ever needs one.
const attempts = new Map<string, number[]>();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    attempts.set(key, recent);
    return true;
  }
  recent.push(now);
  attempts.set(key, recent);
  return false;
}
