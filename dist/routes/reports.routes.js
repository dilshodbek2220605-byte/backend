"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const serialize_1 = require("../lib/serialize");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../middleware/auth");
const error_1 = require("../middleware/error");
const asyncHandler_1 = require("../utils/asyncHandler");
const report_service_1 = require("../services/report.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth, (0, auth_1.requireRole)('ADMIN'));
/** GET /api/reports/dashboard - boshqaruv paneli statistikasi */
router.get('/dashboard', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const stats = await (0, report_service_1.getDashboardStats)(req.user.storeId);
    res.json(stats);
}));
const breakdownSchema = zod_1.z.object({
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    groupBy: zod_1.z.enum(['day', 'payment', 'product']).default('day'),
    cashierId: zod_1.z.string().optional(),
});
/** GET /api/reports/sales?groupBy=day|payment|product */
router.get('/sales', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const q = breakdownSchema.parse(req.query);
    const report = await (0, report_service_1.getSalesBreakdown)(req.user.storeId, {
        from: q.from,
        to: q.to,
        groupBy: q.groupBy,
        cashierId: q.cashierId,
    });
    res.json(report);
}));
/** GET /api/reports/store - do'kon sozlamalari */
router.get('/store', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const store = await prisma_1.prisma.store.findUnique({ where: { id: req.user.storeId } });
    if (!store)
        throw (0, error_1.notFoundErr)("Do'kon topilmadi");
    res.json({ store: (0, serialize_1.serializeStore)(store) });
}));
const storeSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2, "Do'kon nomini kiriting").max(120).optional(),
    phone: zod_1.z.string().trim().max(40).nullish(),
    address: zod_1.z.string().trim().max(200).nullish(),
    currency: zod_1.z.string().trim().min(1).max(10).optional(),
    lowStockThreshold: zod_1.z.coerce.number().int().min(0).max(100000).optional(),
});
/** PATCH /api/reports/store - sozlamalarni saqlash */
router.patch('/store', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = storeSchema.parse(req.body);
    const store = await prisma_1.prisma.store.update({
        where: { id: req.user.storeId },
        data: {
            ...(data.name !== undefined ? { name: data.name } : {}),
            ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
            ...(data.address !== undefined ? { address: data.address ?? null } : {}),
            ...(data.currency !== undefined ? { currency: data.currency } : {}),
            ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: data.lowStockThreshold } : {}),
        },
    });
    res.json({ store: (0, serialize_1.serializeStore)(store), message: "Sozlamalar saqlandi" });
}));
exports.default = router;
//# sourceMappingURL=reports.routes.js.map