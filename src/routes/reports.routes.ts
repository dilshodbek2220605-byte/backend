import { Router } from 'express';
import { z } from 'zod';
import { serializeStore } from '../lib/serialize';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { notFoundErr } from '../middleware/error';
import { asyncHandler } from '../utils/asyncHandler';
import { getDashboardStats, getSalesBreakdown } from '../services/report.service';

const router = Router();

router.use(requireAuth, requireRole('ADMIN'));

/** GET /api/reports/dashboard - boshqaruv paneli statistikasi */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const stats = await getDashboardStats(req.user!.storeId);
    res.json(stats);
  }),
);

const breakdownSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['day', 'payment', 'product']).default('day'),
  cashierId: z.string().optional(),
});

/** GET /api/reports/sales?groupBy=day|payment|product */
router.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const q = breakdownSchema.parse(req.query);
    const report = await getSalesBreakdown(req.user!.storeId, {
      from: q.from,
      to: q.to,
      groupBy: q.groupBy,
      cashierId: q.cashierId,
    });
    res.json(report);
  }),
);

/** GET /api/reports/store - do'kon sozlamalari */
router.get(
  '/store',
  asyncHandler(async (req, res) => {
    const store = await prisma.store.findUnique({ where: { id: req.user!.storeId } });
    if (!store) throw notFoundErr("Do'kon topilmadi");
    res.json({ store: serializeStore(store) });
  }),
);

const storeSchema = z.object({
  name: z.string().trim().min(2, "Do'kon nomini kiriting").max(120).optional(),
  phone: z.string().trim().max(40).nullish(),
  address: z.string().trim().max(200).nullish(),
  currency: z.string().trim().min(1).max(10).optional(),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000).optional(),
});

/** PATCH /api/reports/store - sozlamalarni saqlash */
router.patch(
  '/store',
  asyncHandler(async (req, res) => {
    const data = storeSchema.parse(req.body);
    const store = await prisma.store.update({
      where: { id: req.user!.storeId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone ?? null } : {}),
        ...(data.address !== undefined ? { address: data.address ?? null } : {}),
        ...(data.currency !== undefined ? { currency: data.currency } : {}),
        ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: data.lowStockThreshold } : {}),
      },
    });
    res.json({ store: serializeStore(store), message: "Sozlamalar saqlandi" });
  }),
);

export default router;
