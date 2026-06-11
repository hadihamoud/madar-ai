// Simple in-memory rate limiter using a sliding window.
// For production at scale, replace with Redis (Upstash).

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const PRESETS = {
  api: { maxRequests: 100, windowMs: 60_000 },        // 100 req/min per IP
  upload: { maxRequests: 10, windowMs: 60_000 },       // 10 uploads/min per IP
  ai: { maxRequests: 20, windowMs: 60_000 },           // 20 AI calls/min per tenant
  auth: { maxRequests: 5, windowMs: 60_000 },          // 5 auth attempts/min
} as const;

export type RateLimitPreset = keyof typeof PRESETS;

export function checkRateLimit(
  key: string,
  preset: RateLimitPreset = "api"
): { success: boolean; remaining: number; resetAt: number } {
  const config = PRESETS[preset];
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { success: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 5 * 60_000);
}
