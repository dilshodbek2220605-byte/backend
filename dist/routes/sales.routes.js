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
const sale_service_1 = require("../services/sale.service");
const report_service_1 = require("../services/report.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const createSaleSchema = zod_1.z.object({
    items: zod_1.z
        .array(zod_1.z.object({
        productId: zod_1.z.string().min(1),
        quantity: zod_1.z.coerce.number().positive("Miqdor 0 dan katta bo'lishi kerak"),
    }))
        .min(1, "Savat bo'sh"),
    paymentMethod: zod_1.z.enum(['CASH', 'CARD', 'QR']),
    amountPaid: zod_1.z.coerce.number().min(0).nullish(),
    note: zod_1.z.string().trim().max(300).nullish(),
    clientRef: zod_1.z.string().trim().max(80).nullish(),
});
/**
 * POST /api/sales
 * Sotuvni yakunlash. Narxlar HECH QACHON frontenddan olinmaydi -
 * faqat productId + miqdor yuboriladi, qolganini server bazadan hisoblaydi.
 */
router.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const data = createSaleSchema.parse(req.body);
    const result = await (0, sale_service_1.createSale)({
        storeId: req.user.storeId,
        cashierId: req.user.id,
        items: data.items,
        paymentMethod: data.paymentMethod,
        amountPaid: data.amountPaid ?? null,
        note: data.note ?? null,
        clientRef: data.clientRef ?? null,
    });
    res.status(result.duplicated ? 200 : 201).json({
        sale: result.sale,
        duplicated: result.duplicated,
        message: result.duplicated ? 'Bu chek avval yuborilgan' : 'Sotuv muvaffaqiyatli yakunlandi',
    });
}));
const listQuerySchema = zod_1.z.object({
    from: zod_1.z.string().optional(),
    to: zod_1.z.string().optional(),
    cashierId: zod_1.z.string().optional(),
    paymentMethod: zod_1.z.enum(['CASH', 'CARD', 'QR']).optional(),
    mine: zod_1.z.string().optional(),
    all: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(200).default(30),
});
/**
 * GET /api/sales
 * Kassir faqat O'Z sotuvlarini ko'radi. Admin barchasini filtrlab ko'radi.
 */
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const q = listQuerySchema.parse(req.query);
    // Kassir FAQAT o'z cheklarini ko'radi; admin hammasini filtrlab ko'radi
    const cashierId = user.role === 'ADMIN' ? q.cashierId || undefined : user.id;
    const result = await (0, report_service_1.listSales)(user.storeId, {
        from: q.from,
        to: q.to,
        cashierId,
        paymentMethod: q.paymentMethod,
        page: q.page,
        limit: q.limit,
    });
    res.json({
        ...result,
        items: result.items.map(serialize_1.serializeSale),
    });
}));
/** GET /api/sales/:id - bitta chek (kassir faqat o'zinikini) */
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    const sale = await prisma_1.prisma.sale.findFirst({
        where: {
            id: (0, params_1.param)(req, 'id'),
            storeId: user.storeId,
            ...(user.role === 'ADMIN' ? {} : { cashierId: user.id }),
        },
        include: {
            items: true,
            cashier: { select: { id: true, name: true, username: true } },
            store: { select: { name: true, phone: true, address: true, currency: true } },
        },
    });
    if (!sale)
        throw (0, error_1.notFoundErr)('Chek topilmadi', 'SALE_NOT_FOUND');
    res.json({
        sale: (0, serialize_1.serializeSale)(sale),
        receiptStore: {
            name: sale.store.name,
            phone: sale.store.phone,
            address: sale.store.address,
            currency: sale.store.currency,
        },
    });
}));
/** DELETE /api/sales/:id - chekni bekor qilish (faqat ADMIN) + omborga qaytarish */
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const user = req.user;
    if (user.role !== 'ADMIN')
        throw (0, error_1.forbidden)("Chekni faqat administrator bekor qila oladi");
    const sale = await prisma_1.prisma.sale.findFirst({
        where: { id: (0, params_1.param)(req, 'id'), storeId: user.storeId },
        include: { items: true },
    });
    if (!sale)
        throw (0, error_1.notFoundErr)('Chek topilmadi', 'SALE_NOT_FOUND');
    await prisma_1.prisma.$transaction(async (tx) => {
        // Mahsulotlarni omborga qaytaramiz
        for (const item of sale.items) {
            if (!item.productId)
                continue;
            await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
            });
        }
        await tx.sale.delete({ where: { id: sale.id } });
    });
    res.json({ ok: true, message: "Chek bekor qilindi va mahsulotlar omborga qaytarildi" });
}));
exports.default = router;
//# sourceMappingURL=sales.routes.js.map