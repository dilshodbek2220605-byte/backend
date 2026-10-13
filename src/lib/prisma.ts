import { PrismaClient } from '@prisma/client';

/**
 * Bitta PrismaClient nusxasi (dev paytida hot-reload natijasida
 * ulanishlar ko'payib ketmasligi uchun global ga saqlanadi).
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}
