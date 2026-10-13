import type { Request } from 'express';

/**
 * Express 5 da `req.params.x` turi `string | string[]` bo'lishi mumkin
 * (takrorlanuvchi parametrlar uchun). Bu yordamchi har doim bitta
 * toza string qaytaradi va TS ni xotirjam qiladi.
 */
export function param(req: Request, key: string): string {
  const value = (req.params as Record<string, unknown>)[key];
  if (Array.isArray(value)) return String(value[0] ?? '');
  return value === undefined || value === null ? '' : String(value);
}
