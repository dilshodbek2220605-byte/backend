import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { serializeUser } from '../lib/serialize';
import { requireAuth, requireRole } from '../middleware/auth';
import { badRequest, conflict, notFoundErr } from '../middleware/error';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/params';
import { generatePassword, hashPassword, slugifyUsername, uniqueUsername } from '../utils/password';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

/**
 * GET /api/users?role=CASHIER
 * Kassirlar boshqaruvi va sotuvlar filtriga kerak bo'ladi.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const roleFilter = req.query.role === 'CASHIER' || req.query.role === 'ADMIN' ? req.query.role : undefined;

    const users = await prisma.user.findMany({
      where: { storeId, ...(roleFilter ? { role: roleFilter } : {}) },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { sales: true } } },
    });

    // Bugungi sotuvlar sonini ham qo'shamiz (kassirlar jadvali uchun foydali)
    res.json({
      items: users.map((u) => ({
        ...serializeUser(u),
        salesCount: u._count.sales,
      })),
    });
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(2, 'Ismni kiriting').max(80),
  role: z.enum(['ADMIN', 'CASHIER']).default('CASHIER'),
  username: z.string().trim().min(3, "Foydalanuvchi nomi kamida 3 belgi").max(40).optional(),
  password: z.string().min(4, "Parol kamida 4 belgi").max(200).optional(),
});

/**
 * POST /api/users
 * Kassir yaratish. Username/parol yozilmasa - avtomatik generatsiya qilinadi
 * va parol FAQAT SHU JAVOBDA bir marta ko'rsatiladi.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const data = createSchema.parse(req.body);

    const all = await prisma.user.findMany({ select: { username: true } });
    const taken = all.map((u) => u.username);

    let username = data.username ? data.username.toLowerCase() : slugifyUsername(data.name);
    username = uniqueUsername(username, taken);

    const plainPassword = data.password ?? generatePassword(8);
    const user = await prisma.user.create({
      data: {
        storeId,
        name: data.name,
        username,
        passwordHash: await hashPassword(plainPassword),
        role: data.role,
      },
    });

    res.status(201).json({
      user: serializeUser(user),
      // DIQQAT: bu parol faqat bir marta ko'rsatiladi, saqlab qo'ying!
      generatedPassword: data.password ? null : plainPassword,
      credentials: { username, password: plainPassword },
    });
  }),
);

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'CASHIER']).optional(),
});

/** PATCH /api/users/:id - ismini o'zgartirish, bloklash/faollashtirish */
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const data = updateSchema.parse(req.body);

    const user = await prisma.user.findFirst({ where: { id: param(req, 'id'), storeId } });
    if (!user) throw notFoundErr('Foydalanuvchi topilmadi');

    // O'zini bloklab qo'yishning oldini olamiz
    if (user.id === req.user!.id && data.isActive === false) {
      throw badRequest("O'zingizni faolsizlantira olmaysiz", 'SELF_DEACTIVATE');
    }
    if (user.id === req.user!.id && data.role === 'CASHIER') {
      throw badRequest("O'z rolingizni kassirga o'zgartira olmaysiz", 'SELF_DEMOTE');
    }
    // Oxirgi adminni yo'qotib qo'ymaslik
    if (user.role === 'ADMIN' && (data.isActive === false || data.role === 'CASHIER')) {
      const activeAdmins = await prisma.user.count({
        where: { storeId, role: 'ADMIN', isActive: true },
      });
      if (activeAdmins <= 1) throw conflict("Kamida bitta faol administrator qolishi kerak", 'LAST_ADMIN');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
      },
    });

    res.json({ user: serializeUser(updated) });
  }),
);

/** POST /api/users/:id/reset-password - yangi parol generatsiya qilish */
router.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const user = await prisma.user.findFirst({ where: { id: param(req, 'id'), storeId } });
    if (!user) throw notFoundErr('Foydalanuvchi topilmadi');

    const plainPassword = generatePassword(8);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(plainPassword) },
    });

    res.json({
      ok: true,
      username: user.username,
      generatedPassword: plainPassword,
      message: "Yangi parol yaratildi. Bu parolni kassirga yetkazing",
    });
  }),
);

/**
 * DELETE /api/users/:id
 * Sotuvlari bo'lsa - faolsizlantiramiz (hisobot buzilmaydi),
 * aks holda butunlay o'chiramiz.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const user = await prisma.user.findFirst({ where: { id: param(req, 'id'), storeId } });
    if (!user) throw notFoundErr('Foydalanuvchi topilmadi');

    if (user.id === req.user!.id) throw badRequest("O'zingizni o'chira olmaysiz", 'SELF_DELETE');

    if (user.role === 'ADMIN') {
      const activeAdmins = await prisma.user.count({ where: { storeId, role: 'ADMIN', isActive: true } });
      if (activeAdmins <= 1) throw conflict("Kamida bitta faol administrator qolishi kerak", 'LAST_ADMIN');
    }

    const salesCount = await prisma.sale.count({ where: { cashierId: user.id } });
    if (salesCount > 0) {
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
      res.json({
        ok: true,
        deactivated: true,
        message: "Kassir faolsizlantirildi (uning sotuvlari tarixda saqlanadi)",
      });
      return;
    }

    await prisma.user.delete({ where: { id: user.id } });
    res.json({ ok: true, deactivated: false, message: "Kassir o'chirildi" });
  }),
);

export default router;
