import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { serializeUser } from '../lib/serialize';
import { requireAuth } from '../middleware/auth';
import { badRequest, unauthorized } from '../middleware/error';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { signToken } from '../utils/jwt';
import { comparePassword, hashPassword } from '../utils/password';

const router = Router();

const loginSchema = z.object({
  username: z.string().trim().min(1, 'Foydalanuvchi nomini kiriting').max(60),
  password: z.string().min(1, 'Parolni kiriting').max(200),
});

/**
 * POST /api/auth/login
 * Login uchun oddiy: username + parol. Do'kon avtomatik aniqlanadi.
 */
router.post(
  '/login',
  // Brute-force himoyasi: 10 daqiqada 15 urinish
  rateLimit({ windowMs: 10 * 60 * 1000, max: 15 }),
  asyncHandler(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: { store: true },
    });

    // Xavfsizlik: "foydalanuvchi yo'q" va "parol xato" - bir xil xabar
    if (!user) throw unauthorized('Foydalanuvchi nomi yoki parol xato');

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw unauthorized('Foydalanuvchi nomi yoki parol xato');

    if (!user.isActive) {
      throw unauthorized("Hisobingiz faolsizlantirilgan. Administrator bilan bog'lanishing");
    }

    const token = signToken({
      sub: user.id,
      role: user.role,
      storeId: user.storeId,
      username: user.username,
    });

    res.json({ token, user: serializeUser(user) });
  }),
);

/** GET /api/auth/me - joriy foydalanuvchi */
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { store: true },
    });
    if (!user) throw unauthorized();
    res.json({ user: serializeUser(user) });
  }),
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Joriy parolni kiriting'),
  newPassword: z.string().min(4, "Yangi parol kamida 4 belgidan iborat bo'lsin").max(200),
});

/** POST /api/auth/change-password */
router.post(
  '/change-password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw unauthorized();

    const ok = await comparePassword(currentPassword, user.passwordHash);
    if (!ok) throw badRequest('Joriy parol xato', 'WRONG_PASSWORD');

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });

    res.json({ ok: true, message: "Parol muvaffaqiyatli o'zgartirildi" });
  }),
);

export default router;
