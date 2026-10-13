import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = 'ERROR', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, code = 'BAD_REQUEST', details?: unknown) =>
  new ApiError(400, msg, code, details);
export const unauthorized = (msg = 'Avtorizatsiya kerak') => new ApiError(401, msg, 'UNAUTHORIZED');
export const forbidden = (msg = "Ruxsat yo'q") => new ApiError(403, msg, 'FORBIDDEN');
export const notFoundErr = (msg: string, code = 'NOT_FOUND') => new ApiError(404, msg, code);
export const conflict = (msg: string, code = 'CONFLICT', details?: unknown) =>
  new ApiError(409, msg, code, details);

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "So'ralgan manzil topilmadi", code: 'ROUTE_NOT_FOUND' });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Ma'lumotlar noto'g'ri kiritilgan",
      code: 'VALIDATION_ERROR',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
    return;
  }

  // Prisma unique constraint (P2002) kabi xatolar
  const anyErr = err as { code?: string; meta?: Record<string, unknown>; message?: string };
  if (anyErr?.code === 'P2002') {
    const target = (anyErr.meta?.target as string[] | undefined)?.join(', ') ?? 'maydon';
    res.status(409).json({
      message: `Bu qiymat allaqachon mavjud (${target})`,
      code: 'DUPLICATE',
    });
    return;
  }
  if (anyErr?.code === 'P2025') {
    res.status(404).json({ message: 'Yozuv topilmadi', code: 'NOT_FOUND' });
    return;
  }

  // Noto'g'ri JSON yuborilganda (express.json parse xatosi)
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: "JSON noto'g'ri formatda", code: 'INVALID_JSON' });
    return;
  }

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) console.error('[xato]', err);
  res.status(500).json({
    message: "Serverda kutilmagan xatolik yuz berdi",
    code: 'INTERNAL_ERROR',
    ...(isProd ? {} : { details: anyErr?.message }),
  });
}
