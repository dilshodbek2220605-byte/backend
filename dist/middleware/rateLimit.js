"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
const error_1 = require("./error");
/**
 * Juda yengil in-memory rate limiter (qo'shimcha kutubxonasiz).
 * Asosan login endpointini parol terib topishdan (brute-force) himoya qiladi.
 */
function rateLimit(options) {
    const buckets = new Map();
    return (req, res, next) => {
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
            next(new error_1.ApiError(429, `Juda ko'p urinish. ${waitSec} soniyadan keyin qayta urinib ko'ring`, 'TOO_MANY_REQUESTS'));
            return;
        }
        next();
    };
}
//# sourceMappingURL=rateLimit.js.map