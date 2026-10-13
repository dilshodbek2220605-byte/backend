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
const router = (0, express_1.Router)();
// Barcha mahsulot yo'llari uchun autentifikatsiya shart
router.use(auth_1.requireAuth);
const listQuerySchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    category: zod_1.z.string().trim().optional(),
    lowStock: zod_1.z.string().optional(),
    includeInactive: zod_1.z.string().optional(),
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(300).default(50),
    sort: zod_1.z.enum(['name', 'recent', 'stock', 'price']).default('name'),
});
/**
 * GET /api/products
 * Qidiruv, kategoriya, kam qoldiq filtri + sahifalash.
 */
router.get('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const q = listQuerySchema.parse(req.query);
    const store = await prisma_1.prisma.store.findUnique({
        where: { id: storeId },
        select: { lowStockThreshold: true },
    });
    const threshold = store?.lowStockThreshold ?? 5;
    const where = {
        storeId,
        ...(q.includeInactive === '1' || q.includeInactive === 'true' ? {} : { isActive: true }),
        ...(q.category ? { category: q.category } : {}),
        ...(q.lowStock === '1' || q.lowStock === 'true' ? { stock: { lte: threshold } } : {}),
        ...(q.search
            ? {
                OR: [
                    { name: { contains: q.search, mode: 'insensitive' } },
                    { barcode: { contains: q.search } },
                    { category: { contains: q.search, mode: 'insensitive' } },
                ],
            }
            : {}),
    };
    const orderBy = q.sort === 'recent'
        ? { createdAt: 'desc' }
        : q.sort === 'stock'
            ? { stock: 'asc' }
            : q.sort === 'price'
                ? { price: 'desc' }
                : { name: 'asc' };
    const [total, products] = await Promise.all([
        prisma_1.prisma.product.count({ where }),
        prisma_1.prisma.product.findMany({
            where,
            orderBy,
            skip: (q.page - 1) * q.limit,
            take: q.limit,
        }),
    ]);
    res.json({
        total,
        page: q.page,
        limit: q.limit,
        pages: Math.max(1, Math.ceil(total / q.limit)),
        threshold,
        items: products.map(serialize_1.serializeProduct),
    });
}));
/** GET /api/products/categories - filtr uchun ro'yxat */
router.get('/categories', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const grouped = await prisma_1.prisma.product.groupBy({
        by: ['category'],
        where: { storeId: req.user.storeId, isActive: true },
        _count: { _all: true },
    });
    res.json({
        items: grouped
            .map((g) => ({ category: g.category, count: g._count._all }))
            .sort((a, b) => a.category.localeCompare(b.category)),
    });
}));
/**
 * GET /api/products/barcode/:barcode
 * ⚡ SKANER UCHUN ASOSIY NUQTA - indexed barcode bo'yicha bir marta qidiruv.
 * Topilmasa 404 + BARCODE_NOT_FOUND (frontend "Mahsulot topilmadi" oynasini ochadi).
 */
router.get('/barcode/:barcode', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const barcode = (0, params_1.param)(req, 'barcode').trim();
    if (!barcode)
        throw (0, error_1.notFoundErr)("Shtrix kod ko'rsatilmagan", 'BARCODE_NOT_FOUND');
    const product = await prisma_1.prisma.product.findFirst({
        where: { storeId: req.user.storeId, barcode },
    });
    if (!product) {
        throw (0, error_1.notFoundErr)('Mahsulot topilmadi', 'BARCODE_NOT_FOUND');
    }
    if (!product.isActive) {
        throw (0, error_1.conflict)(`${product.name} sotuvdan chiqarilgan`, 'PRODUCT_INACTIVE', {
            product: (0, serialize_1.serializeProduct)(product),
        });
    }
    res.json({ product: (0, serialize_1.serializeProduct)(product) });
}));
/** GET /api/products/:id */
router.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const product = await prisma_1.prisma.product.findFirst({
        where: { id: (0, params_1.param)(req, 'id'), storeId: req.user.storeId },
    });
    if (!product)
        throw (0, error_1.notFoundErr)('Mahsulot topilmadi');
    res.json({ product: (0, serialize_1.serializeProduct)(product) });
}));
const productSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(1, 'Mahsulot nomini kiriting').max(160),
    barcode: zod_1.z.string().trim().min(1, 'Shtrix kodni kiriting').max(64),
    category: zod_1.z.string().trim().max(60).optional(),
    unit: zod_1.z.string().trim().max(20).optional(),
    price: zod_1.z.coerce.number().min(0, "Narx manfiy bo'lmaydi"),
    costPrice: zod_1.z.coerce.number().min(0).nullish(),
    stock: zod_1.z.coerce.number().min(0).optional(),
});
/** POST /api/products (faqat ADMIN) */
router.post('/', (0, auth_1.requireRole)('ADMIN'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const data = productSchema.parse(req.body);
    const existing = await prisma_1.prisma.product.findFirst({
        where: { storeId, barcode: data.barcode },
        select: { id: true, name: true },
    });
    if (existing) {
        throw (0, error_1.conflict)(`Bu shtrix kod allaqachon mavjud: ${existing.name}`, 'DUPLICATE_BARCODE', {
            productId: existing.id,
        });
    }
    const product = await prisma_1.prisma.product.create({
        data: {
            storeId,
            name: data.name,
            barcode: data.barcode,
            category: data.category?.trim() || 'Umumiy',
            unit: data.unit?.trim() || 'dona',
            price: data.price,
            costPrice: data.costPrice ?? null,
            stock: data.stock ?? 0,
        },
    });
    res.status(201).json({ product: (0, serialize_1.serializeProduct)(product) });
}));
/** PATCH /api/products/:id (faqat ADMIN) */
router.patch('/:id', (0, auth_1.requireRole)('ADMIN'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const partial = productSchema.partial().parse(req.body);
    const current = await prisma_1.prisma.product.findFirst({
        where: { id: (0, params_1.param)(req, 'id'), storeId },
    });
    if (!current)
        throw (0, error_1.notFoundErr)('Mahsulot topilmadi');
    if (partial.barcode && partial.barcode !== current.barcode) {
        const dup = await prisma_1.prisma.product.findFirst({
            where: { storeId, barcode: partial.barcode, NOT: { id: current.id } },
            select: { id: true, name: true },
        });
        if (dup)
            throw (0, error_1.conflict)(`Bu shtrix kod boshqa mahsulotda: ${dup.name}`, 'DUPLICATE_BARCODE');
    }
    const product = await prisma_1.prisma.product.update({
        where: { id: current.id },
        data: {
            ...(partial.name !== undefined ? { name: partial.name } : {}),
            ...(partial.barcode !== undefined ? { barcode: partial.barcode } : {}),
            ...(partial.category !== undefined ? { category: partial.category || 'Umumiy' } : {}),
            ...(partial.unit !== undefined ? { unit: partial.unit || 'dona' } : {}),
            ...(partial.price !== undefined ? { price: partial.price } : {}),
            ...(partial.costPrice !== undefined ? { costPrice: partial.costPrice ?? null } : {}),
            ...(partial.stock !== undefined ? { stock: partial.stock } : {}),
        },
    });
    res.json({ product: (0, serialize_1.serializeProduct)(product) });
}));
const stockSchema = zod_1.z.object({
    amount: zod_1.z.coerce.number().refine((v) => v !== 0, "Miqdor 0 bo'lmasligi kerak"),
    mode: zod_1.z.enum(['delta', 'set']).default('delta'),
});
/** PATCH /api/products/:id/stock - omborni tez to'ldirish yoki to'g'rilash */
router.patch('/:id/stock', (0, auth_1.requireRole)('ADMIN'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const { amount, mode } = stockSchema.parse(req.body);
    const current = await prisma_1.prisma.product.findFirst({ where: { id: (0, params_1.param)(req, 'id'), storeId } });
    if (!current)
        throw (0, error_1.notFoundErr)('Mahsulot topilmadi');
    const nextStock = mode === 'set' ? amount : (0, serialize_1.num)(current.stock) + amount;
    if (nextStock < 0)
        throw (0, error_1.conflict)("Ombordagi miqdor manfiy bo'la olmaydi", 'NEGATIVE_STOCK');
    const product = await prisma_1.prisma.product.update({
        where: { id: current.id },
        data: { stock: nextStock },
    });
    res.json({ product: (0, serialize_1.serializeProduct)(product) });
}));
/**
 * DELETE /api/products/:id (faqat ADMIN)
 * Agar mahsulot sotilgan bo'lsa - o'chirmaymiz, faqat "sotuvdan chiqaramiz"
 * (chek tarixi buzilmasligi uchun).
 */
router.delete('/:id', (0, auth_1.requireRole)('ADMIN'), (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const storeId = req.user.storeId;
    const product = await prisma_1.prisma.product.findFirst({ where: { id: (0, params_1.param)(req, 'id'), storeId } });
    if (!product)
        throw (0, error_1.notFoundErr)('Mahsulot topilmadi');
    const soldCount = await prisma_1.prisma.saleItem.count({ where: { productId: product.id } });
    if (soldCount > 0) {
        await prisma_1.prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
        res.json({
            ok: true,
            deactivated: true,
            message: "Mahsulot sotuvdan chiqarildi (sotuv tarixi saqlab qolindi)",
        });
        return;
    }
    await prisma_1.prisma.product.delete({ where: { id: product.id } });
    res.json({ ok: true, deactivated: false, message: "Mahsulot o'chirildi" });
}));
exports.default = router;
//# sourceMappingURL=products.routes.js.map