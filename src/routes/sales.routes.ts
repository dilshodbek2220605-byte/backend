import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { serializeSale } from '../lib/serialize';
import { requireAuth } from '../middleware/auth';
import { forbidden, notFoundErr } from '../middleware/error';
import { asyncHandler } from '../utils/asyncHandler';
import { param } from '../utils/params';
import { createSale } from '../services/sale.service';
import { listSales } from '../services/report.service';

const router = Router();

router.use(requireAuth);

const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().positive("Miqdor 0 dan katta bo'lishi kerak"),
      }),
    )
    .min(1, "Savat bo'sh"),
  paymentMethod: z.enum(['CASH', 'CARD', 'QR']),
  amountPaid: z.coerce.number().min(0).nullish(),
  note: z.string().trim().max(300).nullish(),
  clientRef: z.string().trim().max(80).nullish(),
});

/**
 * POST /api/sales
 * Sotuvni yakunlash. Narxlar HECH QACHON frontenddan olinmaydi -
 * faqat productId + miqdor yuboriladi, qolganini server bazadan hisoblaydi.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = createSaleSchema.parse(req.body);

    const result = await createSale({
      storeId: req.user!.storeId,
      cashierId: req.user!.id,
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
  }),
);

const listQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  cashierId: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'QR']).optional(),
  mine: z.string().optional(),
  all: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(30),
});

/**
 * GET /api/sales
 * Kassir faqat O'Z sotuvlarini ko'radi. Admin barchasini filtrlab ko'radi.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const q = listQuerySchema.parse(req.query);

    // Kassir FAQAT o'z cheklarini ko'radi; admin hammasini filtrlab ko'radi
    const cashierId = user.role === 'ADMIN' ? q.cashierId || undefined : user.id;

    const result = await listSales(user.storeId, {
      from: q.from,
      to: q.to,
      cashierId,
      paymentMethod: q.paymentMethod,
      page: q.page,
      limit: q.limit,
    });

    res.json({
      ...result,
      items: result.items.map(serializeSale),
    });
  }),
);

/** GET /api/sales/:id - bitta chek (kassir faqat o'zinikini) */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;

    const sale = await prisma.sale.findFirst({
      where: {
        id: param(req, 'id'),
        storeId: user.storeId,
        ...(user.role === 'ADMIN' ? {} : { cashierId: user.id }),
      },
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
        store: { select: { name: true, phone: true, address: true, currency: true } },
      },
    });

    if (!sale) throw notFoundErr('Chek topilmadi', 'SALE_NOT_FOUND');

    res.json({
      sale: serializeSale(sale),
      receiptStore: {
        name: sale.store.name,
        phone: sale.store.phone,
        address: sale.store.address,
        currency: sale.store.currency,
      },
    });
  }),
);

/** DELETE /api/sales/:id - chekni bekor qilish (faqat ADMIN) + omborga qaytarish */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    if (user.role !== 'ADMIN') throw forbidden("Chekni faqat administrator bekor qila oladi");

    const sale = await prisma.sale.findFirst({
      where: { id: param(req, 'id'), storeId: user.storeId },
      include: { items: true },
    });
    if (!sale) throw notFoundErr('Chek topilmadi', 'SALE_NOT_FOUND');

    await prisma.$transaction(async (tx) => {
      // Mahsulotlarni omborga qaytaramiz
      for (const item of sale.items) {
        if (!item.productId) continue;
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.sale.delete({ where: { id: sale.id } });
    });

    res.json({ ok: true, message: "Chek bekor qilindi va mahsulotlar omborga qaytarildi" });
  }),
);

export default router;
