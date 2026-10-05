/**
 * A small in-memory sliding-window rate limiter for the public share route.
 *
 * Honest limits: on a serverless host each running instance has its own memory,
 * so this is best-effort protection against a single address hammering one
 * instance. The real defence against guessing is the token itself (256 random
 * bits). Keys are IP addresses; the map is pruned so it cannot grow forever.
 */

export interface Limiter {
  /** Records a hit; returns false when the key is over its limit. */
  hit(key: string, now?: number): boolean;
  /** How many hits the key has in the current window (without recording one). */
  count(key: string, now?: number): number;
  /** Forget every hit (used by tests). */
  reset(): void;
}

export function createLimiter(limit: number, windowMs: number, maxKeys = 5000): Limiter {
  const hits = new Map<string, number[]>();

  const recent = (key: string, now: number) => (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  return {
    hit(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length >= limit) {
        hits.set(key, list);
        return false;
      }
      list.push(now);
      hits.set(key, list);
      if (hits.size > maxKeys) {
        // Drop the oldest-inserted keys first; enough to stay bounded without a timer.
        for (const k of hits.keys()) {
          hits.delete(k);
          if (hits.size <= maxKeys * 0.9) break;
        }
      }
      return true;
    },
    count(key, now = Date.now()) {
      return recent(key, now).length;
    },
    reset() {
      hits.clear();
    },
  };
}

/** First address in x-forwarded-for, else a constant (so unknown clients share one bucket). */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim().slice(0, 64) : "unknown";
}
