import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { num, serializeProduct } from '../lib/serialize';
import { requireAuth, requireRole } from '../middleware/auth';
import { conflict, notFoundErr } from '../middleware/error';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/params';

const router = Router();

// Barcha mahsulot yo'llari uchun autentifikatsiya shart
router.use(requireAuth);

const listQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  lowStock: z.string().optional(),
  includeInactive: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(300).default(50),
  sort: z.enum(['name', 'recent', 'stock', 'price']).default('name'),
});

/**
 * GET /api/products
 * Qidiruv, kategoriya, kam qoldiq filtri + sahifalash.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const q = listQuerySchema.parse(req.query);

    const store = await prisma.store.findUnique({
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
              { name: { contains: q.search, mode: 'insensitive' as const } },
              { barcode: { contains: q.search } },
              { category: { contains: q.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const orderBy =
      q.sort === 'recent'
        ? { createdAt: 'desc' as const }
        : q.sort === 'stock'
          ? { stock: 'asc' as const }
          : q.sort === 'price'
            ? { price: 'desc' as const }
            : { name: 'asc' as const };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
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
      items: products.map(serializeProduct),
    });
  }),
);

/** GET /api/products/categories - filtr uchun ro'yxat */
router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const grouped = await prisma.product.groupBy({
      by: ['category'],
      where: { storeId: req.user!.storeId, isActive: true },
      _count: { _all: true },
    });
    res.json({
      items: grouped
        .map((g) => ({ category: g.category, count: g._count._all }))
        .sort((a, b) => a.category.localeCompare(b.category)),
    });
  }),
);

/**
 * GET /api/products/barcode/:barcode
 * ⚡ SKANER UCHUN ASOSIY NUQTA - indexed barcode bo'yicha bir marta qidiruv.
 * Topilmasa 404 + BARCODE_NOT_FOUND (frontend "Mahsulot topilmadi" oynasini ochadi).
 */
router.get(
  '/barcode/:barcode',
  asyncHandler(async (req, res) => {
    const barcode = param(req, 'barcode').trim();
    if (!barcode) throw notFoundErr("Shtrix kod ko'rsatilmagan", 'BARCODE_NOT_FOUND');

    const product = await prisma.product.findFirst({
      where: { storeId: req.user!.storeId, barcode },
    });

    if (!product) {
      throw notFoundErr('Mahsulot topilmadi', 'BARCODE_NOT_FOUND');
    }
    if (!product.isActive) {
      throw conflict(`${product.name} sotuvdan chiqarilgan`, 'PRODUCT_INACTIVE', {
        product: serializeProduct(product),
      });
    }

    res.json({ product: serializeProduct(product) });
  }),
);

/** GET /api/products/:id */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { id: param(req, 'id'), storeId: req.user!.storeId },
    });
    if (!product) throw notFoundErr('Mahsulot topilmadi');
    res.json({ product: serializeProduct(product) });
  }),
);

const productSchema = z.object({
  name: z.string().trim().min(1, 'Mahsulot nomini kiriting').max(160),
  barcode: z.string().trim().min(1, 'Shtrix kodni kiriting').max(64),
  category: z.string().trim().max(60).optional(),
  unit: z.string().trim().max(20).optional(),
  price: z.coerce.number().min(0, "Narx manfiy bo'lmaydi"),
  costPrice: z.coerce.number().min(0).nullish(),
  stock: z.coerce.number().min(0).optional(),
});

/** POST /api/products (faqat ADMIN) */
router.post(
  '/',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const data = productSchema.parse(req.body);

    const existing = await prisma.product.findFirst({
      where: { storeId, barcode: data.barcode },
      select: { id: true, name: true },
    });
    if (existing) {
      throw conflict(`Bu shtrix kod allaqachon mavjud: ${existing.name}`, 'DUPLICATE_BARCODE', {
        productId: existing.id,
      });
    }

    const product = await prisma.product.create({
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

    res.status(201).json({ product: serializeProduct(product) });
  }),
);

/** PATCH /api/products/:id (faqat ADMIN) */
router.patch(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const partial = productSchema.partial().parse(req.body);

    const current = await prisma.product.findFirst({
      where: { id: param(req, 'id'), storeId },
    });
    if (!current) throw notFoundErr('Mahsulot topilmadi');

    if (partial.barcode && partial.barcode !== current.barcode) {
      const dup = await prisma.product.findFirst({
        where: { storeId, barcode: partial.barcode, NOT: { id: current.id } },
        select: { id: true, name: true },
      });
      if (dup) throw conflict(`Bu shtrix kod boshqa mahsulotda: ${dup.name}`, 'DUPLICATE_BARCODE');
    }

    const product = await prisma.product.update({
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

    res.json({ product: serializeProduct(product) });
  }),
);

const stockSchema = z.object({
  amount: z.coerce.number().refine((v) => v !== 0, "Miqdor 0 bo'lmasligi kerak"),
  mode: z.enum(['delta', 'set']).default('delta'),
});

/** PATCH /api/products/:id/stock - omborni tez to'ldirish yoki to'g'rilash */
router.patch(
  '/:id/stock',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const { amount, mode } = stockSchema.parse(req.body);

    const current = await prisma.product.findFirst({ where: { id: param(req, 'id'), storeId } });
    if (!current) throw notFoundErr('Mahsulot topilmadi');

    const nextStock = mode === 'set' ? amount : num(current.stock) + amount;
    if (nextStock < 0) throw conflict("Ombordagi miqdor manfiy bo'la olmaydi", 'NEGATIVE_STOCK');

    const product = await prisma.product.update({
      where: { id: current.id },
      data: { stock: nextStock },
    });

    res.json({ product: serializeProduct(product) });
  }),
);

/**
 * DELETE /api/products/:id (faqat ADMIN)
 * Agar mahsulot sotilgan bo'lsa - o'chirmaymiz, faqat "sotuvdan chiqaramiz"
 * (chek tarixi buzilmasligi uchun).
 */
router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    const storeId = req.user!.storeId;
    const product = await prisma.product.findFirst({ where: { id: param(req, 'id'), storeId } });
    if (!product) throw notFoundErr('Mahsulot topilmadi');

    const soldCount = await prisma.saleItem.count({ where: { productId: product.id } });

    if (soldCount > 0) {
      await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
      res.json({
        ok: true,
        deactivated: true,
        message: "Mahsulot sotuvdan chiqarildi (sotuv tarixi saqlab qolindi)",
      });
      return;
    }

    await prisma.product.delete({ where: { id: product.id } });
    res.json({ ok: true, deactivated: false, message: "Mahsulot o'chirildi" });
  }),
);

export default router;
