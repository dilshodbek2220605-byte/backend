import type { NextFunction, Request, Response } from 'express';
import { ApiError } from './error';

type Bucket = { count: number; resetAt: number };

/**
 * Juda yengil in-memory rate limiter (qo'shimcha kutubxonasiz).
 * Asosan login endpointini parol terib topishdan (brute-force) himoya qiladi.
 */
export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = `${req.ip ?? 'unknown'}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const waitSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(waitSec));
      next(
        new ApiError(
          429,
          `Juda ko'p urinish. ${waitSec} soniyadan keyin qayta urinib ko'ring`,
          'TOO_MANY_REQUESTS',
        ),
      );
      return;
    }
    next();
  };
}
