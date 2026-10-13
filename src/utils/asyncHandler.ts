import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * async route handler ichidagi xatolarni markaziy error handler ga uzatadi.
 * (Express 5 o'zi ham qila oladi, lekin bu har qanday holatda ishonchli.)
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
