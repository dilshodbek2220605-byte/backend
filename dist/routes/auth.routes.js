"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const serialize_1 = require("../lib/serialize");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const rateLimit_1 = require("../middleware/rateLimit");
const asyncHandler_1 = require("../utils/asyncHandler");
const jwt_1 = require("../utils/jwt");
const password_1 = require("../utils/password");
const router = (0, express_1.Router)();
const loginSchema = zod_1.z.object({
    username: zod_1.z.string().trim().min(1, 'Foydalanuvchi nomini kiriting').max(60),
    password: zod_1.z.string().min(1, 'Parolni kiriting').max(200),
});
/**
 * POST /api/auth/login
 * Login uchun oddiy: username + parol. Do'kon avtomatik aniqlanadi.
 */
router.post('/login', 
// Brute-force himoyasi: 10 daqiqada 15 urinish
(0, rateLimit_1.rateLimit)({ windowMs: 10 * 60 * 1000, max: 15 }), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { username, password } = loginSchema.parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({
        where: { username: username.toLowerCase() },
        include: { store: true },
    });
    // Xavfsizlik: "foydalanuvchi yo'q" va "parol xato" - bir xil xabar
    if (!user)
        throw (0, error_1.unauthorized)('Foydalanuvchi nomi yoki parol xato');
    const ok = await (0, password_1.comparePassword)(password, user.passwordHash);
    if (!ok)
        throw (0, error_1.unauthorized)('Foydalanuvchi nomi yoki parol xato');
    if (!user.isActive) {
        throw (0, error_1.unauthorized)("Hisobingiz faolsizlantirilgan. Administrator bilan bog'lanishing");
    }
    const token = (0, jwt_1.signToken)({
        sub: user.id,
        role: user.role,
        storeId: user.storeId,
        username: user.username,
    });
    res.json({ token, user: (0, serialize_1.serializeUser)(user) });
}));
/** GET /api/auth/me - joriy foydalanuvchi */
router.get('/me', auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { store: true },
    });
    if (!user)
        throw (0, error_1.unauthorized)();
    res.json({ user: (0, serialize_1.serializeUser)(user) });
}));
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Joriy parolni kiriting'),
    newPassword: zod_1.z.string().min(4, "Yangi parol kamida 4 belgidan iborat bo'lsin").max(200),
});
/** POST /api/auth/change-password */
router.post('/change-password', auth_1.requireAuth, (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
    const user = await prisma_1.prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user)
        throw (0, error_1.unauthorized)();
    const ok = await (0, password_1.comparePassword)(currentPassword, user.passwordHash);
    if (!ok)
        throw (0, error_1.badRequest)('Joriy parol xato', 'WRONG_PASSWORD');
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await (0, password_1.hashPassword)(newPassword) },
    });
    res.json({ ok: true, message: "Parol muvaffaqiyatli o'zgartirildi" });
}));
exports.default = router;
//# sourceMappingURL=auth.routes.js.map