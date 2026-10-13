import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { forbidden, unauthorized } from './error';
import { verifyToken, type Role } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        storeId: string;
        role: Role;
        username: string;
        name: string;
      };
    }
  }
}

/**
 * JWT ni tekshiradi VA foydalanuvchi hali ham aktivligini bazadan biladi.
 * Bu muhim: admin kassirni o'chirsa, uning tokeni darhol ishlamaydi.
 * Shuningdek storeId har doim bazadan olinadi -> tenant izolyatsiyasi buzilmaydi.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized("Token yuborilmagan");

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw unauthorized('Token yaroqsiz yoki muddati tugagan');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, storeId: true, role: true, username: true, name: true, isActive: true },
    });

    if (!user) throw unauthorized('Foydalanuvchi topilmadi');
    if (!user.isActive) throw forbidden('Hisobingiz faolsizlantirilgan');

    req.user = {
      id: user.id,
      storeId: user.storeId,
      role: user.role as Role,
      username: user.username,
      name: user.name,
    };
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Bu amal uchun sizda huquq yo\u2019q'));
    }
    next();
  };
}
