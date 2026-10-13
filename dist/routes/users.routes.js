"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const serialize_1 = require("../lib/serialize");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const asyncHandler_1 = require("../utils/asyncHandler");
const params_1 = require("../utils/params");
const password_1 = require("../utils/password");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'));
/**
 * GET /api/users?role=CASHIER
 * Kassirlar boshqaruvi va sotuvlar filtriga kerak bo'ladi.
 */
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const roleFilter = req.query.role === 'CASHIER' || req.query.role === 'ADMIN' ? req.query.role : undefined;
    const users = await prisma_1.prisma.user.findMany({
        where: { storeId, ...(roleFilter ? { role: roleFilter } : {}) },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
        include: { _count: { select: { sales: true } } },
    });
    // Bugungi sotuvlar sonini ham qo'shamiz (kassirlar jadvali uchun foydali)
    res.json({
        items: users.map((u) => ({
            ...(0, serialize_1.serializeUser)(u),
            salesCount: u._count.sales,
        })),
    });
}));
const createSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, 'Ismni kiriting').max(80),
    role: zod_1.z.enum(['ADMIN', 'CASHIER']).default('CASHIER'),
    username: zod_1.z.string().trim().min(3, "Foydalanuvchi nomi kamida 3 belgi").max(40).optional(),
    password: zod_1.z.string().min(4, "Parol kamida 4 belgi").max(200).optional(),
});
/**
 * POST /api/users
 * Kassir yaratish. Username/parol yozilmasa - avtomatik generatsiya qilinadi
 * va parol FAQAT SHU JAVOBDA bir marta ko'rsatiladi.
 */
router.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const data = createSchema.parse(req.body);
    const all = await prisma_1.prisma.user.findMany({ select: { username: true } });
    const taken = all.map((u) => u.username);
    let username = data.username ? data.username.toLowerCase() : (0, password_1.slugifyUsername)(data.name);
    username = (0, password_1.uniqueUsername)(username, taken);
    const plainPassword = data.password ?? (0, password_1.generatePassword)(8);
    const user = await prisma_1.prisma.user.create({
        data: {
            storeId,
            name: data.name,
            username,
            passwordHash: await (0, password_1.hashPassword)(plainPassword),
            role: data.role,
        },
    });
    res.status(201).json({
        user: (0, serialize_1.serializeUser)(user),
        // DIQQAT: bu parol faqat bir marta ko'rsatiladi, saqlab qo'ying!
        generatedPassword: data.password ? null : plainPassword,
        credentials: { username, password: plainPassword },
    });
}));
const updateSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(80).optional(),
    isActive: zod_1.z.boolean().optional(),
    role: zod_1.z.enum(['ADMIN', 'CASHIER']).optional(),
});
/** PATCH /api/users/:id - ismini o'zgartirish, bloklash/faollashtirish */
router.patch('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const data = updateSchema.parse(req.body);
    const user = await prisma_1.prisma.user.findFirst({ where: { id: (0, params_1.param)(req, 'id'), storeId } });
    if (!user)
        throw (0, error_1.notFoundErr)('Foydalanuvchi topilmadi');
    // O'zini bloklab qo'yishning oldini olamiz
    if (user.id === req.user.id && data.isActive === false) {
        throw (0, error_1.badRequest)("O'zingizni faolsizlantira olmaysiz", 'SELF_DEACTIVATE');
    }
    if (user.id === req.user.id && data.role === 'CASHIER') {
        throw (0, error_1.badRequest)("O'z rolingizni kassirga o'zgartira olmaysiz", 'SELF_DEMOTE');
    }
    // Oxirgi adminni yo'qotib qo'ymaslik
    if (user.role === 'ADMIN' && (data.isActive === false || data.role === 'CASHIER')) {
        const activeAdmins = await prisma_1.prisma.user.count({
            where: { storeId, role: 'ADMIN', isActive: true },
        });
        if (activeAdmins <= 1)
            throw (0, error_1.conflict)("Kamida bitta faol administrator qolishi kerak", 'LAST_ADMIN');
    }
    const updated = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
            ...(data.role !== undefined ? { role: data.role } : {}),
        },
    });
    res.json({ user: (0, serialize_1.serializeUser)(updated) });
}));
/** POST /api/users/:id/reset-password - yangi parol generatsiya qilish */
router.post('/:id/reset-password', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const user = await prisma_1.prisma.user.findFirst({ where: { id: (0, params_1.param)(req, 'id'), storeId } });
    if (!user)
        throw (0, error_1.notFoundErr)('Foydalanuvchi topilmadi');
    const plainPassword = (0, password_1.generatePassword)(8);
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await (0, password_1.hashPassword)(plainPassword) },
    });
    res.json({
        ok: true,
        username: user.username,
        generatedPassword: plainPassword,
        message: "Yangi parol yaratildi. Bu parolni kassirga yetkazing",
    });
}));
/**
 * DELETE /api/users/:id
 * Sotuvlari bo'lsa - faolsizlantiramiz (hisobot buzilmaydi),
 * aks holda butunlay o'chiramiz.
 */
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const user = await prisma_1.prisma.user.findFirst({ where: { id: (0, params_1.param)(req, 'id'), storeId } });
    if (!user)
        throw (0, error_1.notFoundErr)('Foydalanuvchi topilmadi');
    if (user.id === req.user.id)
        throw (0, error_1.badRequest)("O'zingizni o'chira olmaysiz", 'SELF_DELETE');
    if (user.role === 'ADMIN') {
        const activeAdmins = await prisma_1.prisma.user.count({ where: { storeId, role: 'ADMIN', isActive: true } });
        if (activeAdmins <= 1)
            throw (0, error_1.conflict)("Kamida bitta faol administrator qolishi kerak", 'LAST_ADMIN');
    }
    const salesCount = await prisma_1.prisma.sale.count({ where: { cashierId: user.id } });
    if (salesCount > 0) {
        await prisma_1.prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
        res.json({
            ok: true,
            deactivated: true,
            message: "Kassir faolsizlantirildi (uning sotuvlari tarixda saqlanadi)",
        });
        return;
    }
    await prisma_1.prisma.user.delete({ where: { id: user.id } });
    res.json({ ok: true, deactivated: false, message: "Kassir o'chirildi" });
}));
exports.default = router;
//# sourceMappingURL=users.routes.js.map