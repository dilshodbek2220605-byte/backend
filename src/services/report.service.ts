import type { PaymentMethod } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { num, round2, serializeProduct, serializeStore } from '../lib/serialize';
import { addDays, dayKey, dayLabel, endOfDay, parseDateRange, startOfDay } from '../utils/dates';

/**
 * Boshqaruv paneli uchun statistika.
 * Kichik do'kon uchun kunlik sotuvlar hajmi kichik, shuning uchun
 * guruhlashni JavaScript tomonida qilamiz - bu SQL dan soddaroq va xavfsiz.
 */
export async function getDashboardStats(storeId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  const threshold = store?.lowStockThreshold ?? 5;

  const todayStart = startOfDay(new Date());
  const weekStart = startOfDay(addDays(new Date(), -6));

  const [todaySales, weekSales, lowStockItems, totalProducts, totalSalesCount] = await Promise.all([
    prisma.sale.findMany({
      where: { storeId, createdAt: { gte: todayStart } },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sale.findMany({
      where: { storeId, createdAt: { gte: weekStart } },
      select: {
        createdAt: true,
        totalAmount: true,
        profitAmount: true,
        itemCount: true,
        paymentMethod: true,
      },
    }),
    prisma.product.findMany({
      where: { storeId, isActive: true, stock: { lte: threshold } },
      orderBy: { stock: 'asc' },
      take: 100,
    }),
    prisma.product.count({ where: { storeId, isActive: true } }),
    prisma.sale.count({ where: { storeId } }),
  ]);

  // ---- Bugungi ko'rsatkichlar ----
  let todayRevenue = 0;
  let todayProfit = 0;
  let todayItems = 0;
  const paymentMap = new Map<PaymentMethod, { total: number; count: number }>();
  const productMap = new Map<string, { name: string; quantity: number; revenue: number }>();

  for (const sale of todaySales) {
    todayRevenue += num(sale.totalAmount);
    todayProfit += num(sale.profitAmount);
    todayItems += num(sale.itemCount);

    const pay = paymentMap.get(sale.paymentMethod) ?? { total: 0, count: 0 };
    pay.total += num(sale.totalAmount);
    pay.count += 1;
    paymentMap.set(sale.paymentMethod, pay);

    for (const item of sale.items) {
      const key = item.productId ?? item.productName;
      const entry = productMap.get(key) ?? { name: item.productName, quantity: 0, revenue: 0 };
      entry.quantity += num(item.quantity);
      entry.revenue += num(item.quantity) * num(item.price);
      productMap.set(key, entry);
    }
  }

  // ---- Oxirgi 7 kun grafigi ----
  const days: { date: string; label: string; revenue: number; profit: number; itemsSold: number }[] = [];
  const dayIndex = new Map<string, (typeof days)[number]>();
  for (let i = 0; i < 7; i += 1) {
    const d = addDays(weekStart, i);
    const entry = {
      date: dayKey(d),
      label: dayLabel(d),
      revenue: 0,
      profit: 0,
      itemsSold: 0,
    };
    days.push(entry);
    dayIndex.set(entry.date, entry);
  }
  for (const sale of weekSales) {
    const entry = dayIndex.get(dayKey(sale.createdAt));
    if (!entry) continue;
    entry.revenue += num(sale.totalAmount);
    entry.profit += num(sale.profitAmount);
    entry.itemsSold += num(sale.itemCount);
  }
  for (const d of days) {
    d.revenue = round2(d.revenue);
    d.profit = round2(d.profit);
    d.itemsSold = Math.round(d.itemsSold * 1000) / 1000;
  }

  const paymentTotals = (['CASH', 'CARD', 'QR'] as PaymentMethod[]).map((method) => {
    const entry = paymentMap.get(method) ?? { total: 0, count: 0 };
    return {
      method,
      label: method === 'CASH' ? 'Naqd' : method === 'CARD' ? 'Karta' : 'QR to\u2019lov',
      total: round2(entry.total),
      count: entry.count,
    };
  });

  const topProducts = [...productMap.entries()]
    .map(([productId, v]) => ({
      productId,
      name: v.name,
      quantity: Math.round(v.quantity * 1000) / 1000,
      revenue: round2(v.revenue),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    today: {
      revenue: round2(todayRevenue),
      profit: round2(todayProfit),
      itemsSold: Math.round(todayItems * 1000) / 1000,
      salesCount: todaySales.length,
    },
    inventory: {
      totalProducts,
      lowStockCount: lowStockItems.length,
      threshold,
      lowStockItems: lowStockItems.slice(0, 20).map(serializeProduct),
    },
    totals: { salesCount: totalSalesCount },
    week: days,
    payments: paymentTotals,
    topProducts,
    store: store ? serializeStore(store) : null,
  };
}

export type GroupBy = 'day' | 'payment' | 'product';

/** Hisobot: davr bo'yicha taqsimot (kun / to'lov turi / mahsulot) */
export async function getSalesBreakdown(
  storeId: string,
  options: { from?: string; to?: string; groupBy: GroupBy; cashierId?: string },
) {
  const createdAt = parseDateRange(options.from, options.to);
  const where = {
    storeId,
    ...(options.cashierId ? { cashierId: options.cashierId } : {}),
    ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
  };

  const sales = await prisma.sale.findMany({
    where,
    include: { items: true, cashier: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });

  let revenue = 0;
  let profit = 0;
  let itemsSold = 0;
  for (const s of sales) {
    revenue += num(s.totalAmount);
    profit += num(s.profitAmount);
    itemsSold += num(s.itemCount);
  }

  if (options.groupBy === 'payment') {
    const map = new Map<string, { key: string; label: string; revenue: number; count: number }>();
    for (const s of sales) {
      const label = s.paymentMethod === 'CASH' ? 'Naqd' : s.paymentMethod === 'CARD' ? 'Karta' : 'QR to\u2019lov';
      const e = map.get(s.paymentMethod) ?? { key: s.paymentMethod, label, revenue: 0, count: 0 };
      e.revenue += num(s.totalAmount);
      e.count += 1;
      map.set(s.paymentMethod, e);
    }
    return {
      summary: { revenue: round2(revenue), profit: round2(profit), itemsSold: round3(itemsSold), salesCount: sales.length },
      rows: [...map.values()].map((r) => ({ ...r, revenue: round2(r.revenue) })).sort((a, b) => b.revenue - a.revenue),
    };
  }

  if (options.groupBy === 'product') {
    const map = new Map<string, { key: string; label: string; quantity: number; revenue: number; profit: number }>();
    for (const s of sales) {
      for (const item of s.items) {
        const key = item.productId ?? item.productName;
        const e = map.get(key) ?? { key, label: item.productName, quantity: 0, revenue: 0, profit: 0 };
        const qty = num(item.quantity);
        e.quantity += qty;
        e.revenue += qty * num(item.price);
        e.profit += qty * (num(item.price) - num(item.unitCost));
        map.set(key, e);
      }
    }
    return {
      summary: { revenue: round2(revenue), profit: round2(profit), itemsSold: round3(itemsSold), salesCount: sales.length },
      rows: [...map.values()]
        .map((r) => ({
          ...r,
          quantity: round3(r.quantity),
          revenue: round2(r.revenue),
          profit: round2(r.profit),
        }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }

  // groupBy === 'day'
  const map = new Map<string, { key: string; label: string; revenue: number; profit: number; count: number }>();
  for (const s of sales) {
    const key = dayKey(s.createdAt);
    const e = map.get(key) ?? { key, label: dayLabel(s.createdAt), revenue: 0, profit: 0, count: 0 };
    e.revenue += num(s.totalAmount);
    e.profit += num(s.profitAmount);
    e.count += 1;
    map.set(key, e);
  }
  return {
    summary: { revenue: round2(revenue), profit: round2(profit), itemsSold: round3(itemsSold), salesCount: sales.length },
    rows: [...map.values()]
      .map((r) => ({ ...r, revenue: round2(r.revenue), profit: round2(r.profit) }))
      .sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Sotuvlar ro'yxati (filtrlar bilan) */
export async function listSales(
  storeId: string,
  options: {
    from?: string;
    to?: string;
    cashierId?: string;
    paymentMethod?: PaymentMethod;
    search?: string;
    mine?: string;
    page: number;
    limit: number;
  },
) {
  const createdAt = parseDateRange(options.from, options.to);
  const where = {
    storeId,
    ...(options.cashierId ? { cashierId: options.cashierId } : {}),
    ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}),
    ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
  };

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: {
        items: true,
        cashier: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    }),
  ]);

  // Davr bo'yicha jamlanma (ro'yxat filtriga mos)
  const all = await prisma.sale.findMany({
    where,
    select: { totalAmount: true, profitAmount: true, itemCount: true },
  });
  const summary = all.reduce(
    (acc, s) => {
      acc.revenue += num(s.totalAmount);
      acc.profit += num(s.profitAmount);
      acc.itemsSold += num(s.itemCount);
      return acc;
    },
    { revenue: 0, profit: 0, itemsSold: 0 },
  );

  return {
    total,
    page: options.page,
    limit: options.limit,
    pages: Math.max(1, Math.ceil(total / options.limit)),
    summary: {
      revenue: round2(summary.revenue),
      profit: round2(summary.profit),
      itemsSold: round3(summary.itemsSold),
      salesCount: all.length,
    },
    items: sales,
  };
}

export { endOfDay };
