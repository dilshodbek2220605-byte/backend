"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.endOfDay = void 0;
exports.getDashboardStats = getDashboardStats;
exports.getSalesBreakdown = getSalesBreakdown;
exports.listSales = listSales;
const prisma_1 = require("../lib/prisma");
const serialize_1 = require("../lib/serialize");
const dates_1 = require("../utils/dates");
Object.defineProperty(exports, "endOfDay", { enumerable: true, get: function () { return dates_1.endOfDay; } });
/**
 * Boshqaruv paneli uchun statistika.
 * Kichik do'kon uchun kunlik sotuvlar hajmi kichik, shuning uchun
 * guruhlashni JavaScript tomonida qilamiz - bu SQL dan soddaroq va xavfsiz.
 */
async function getDashboardStats(storeId) {
    const store = await prisma_1.prisma.store.findUnique({ where: { id: storeId } });
    const threshold = store?.lowStockThreshold ?? 5;
    const todayStart = (0, dates_1.startOfDay)(new Date());
    const weekStart = (0, dates_1.startOfDay)((0, dates_1.addDays)(new Date(), -6));
    const [todaySales, weekSales, lowStockItems, totalProducts, totalSalesCount] = await Promise.all([
        prisma_1.prisma.sale.findMany({
            where: { storeId, createdAt: { gte: todayStart } },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma_1.prisma.sale.findMany({
            where: { storeId, createdAt: { gte: weekStart } },
            select: {
                createdAt: true,
                totalAmount: true,
                profitAmount: true,
                itemCount: true,
                paymentMethod: true,
            },
        }),
        prisma_1.prisma.product.findMany({
            where: { storeId, isActive: true, stock: { lte: threshold } },
            orderBy: { stock: 'asc' },
            take: 100,
        }),
        prisma_1.prisma.product.count({ where: { storeId, isActive: true } }),
        prisma_1.prisma.sale.count({ where: { storeId } }),
    ]);
    // ---- Bugungi ko'rsatkichlar ----
    let todayRevenue = 0;
    let todayProfit = 0;
    let todayItems = 0;
    const paymentMap = new Map();
    const productMap = new Map();
    for (const sale of todaySales) {
        todayRevenue += (0, serialize_1.num)(sale.totalAmount);
        todayProfit += (0, serialize_1.num)(sale.profitAmount);
        todayItems += (0, serialize_1.num)(sale.itemCount);
        const pay = paymentMap.get(sale.paymentMethod) ?? { total: 0, count: 0 };
        pay.total += (0, serialize_1.num)(sale.totalAmount);
        pay.count += 1;
        paymentMap.set(sale.paymentMethod, pay);
        for (const item of sale.items) {
            const key = item.productId ?? item.productName;
            const entry = productMap.get(key) ?? { name: item.productName, quantity: 0, revenue: 0 };
            entry.quantity += (0, serialize_1.num)(item.quantity);
            entry.revenue += (0, serialize_1.num)(item.quantity) * (0, serialize_1.num)(item.price);
            productMap.set(key, entry);
        }
    }
    // ---- Oxirgi 7 kun grafigi ----
    const days = [];
    const dayIndex = new Map();
    for (let i = 0; i < 7; i += 1) {
        const d = (0, dates_1.addDays)(weekStart, i);
        const entry = {
            date: (0, dates_1.dayKey)(d),
            label: (0, dates_1.dayLabel)(d),
            revenue: 0,
            profit: 0,
            itemsSold: 0,
        };
        days.push(entry);
        dayIndex.set(entry.date, entry);
    }
    for (const sale of weekSales) {
        const entry = dayIndex.get((0, dates_1.dayKey)(sale.createdAt));
        if (!entry)
            continue;
        entry.revenue += (0, serialize_1.num)(sale.totalAmount);
        entry.profit += (0, serialize_1.num)(sale.profitAmount);
        entry.itemsSold += (0, serialize_1.num)(sale.itemCount);
    }
    for (const d of days) {
        d.revenue = (0, serialize_1.round2)(d.revenue);
        d.profit = (0, serialize_1.round2)(d.profit);
        d.itemsSold = Math.round(d.itemsSold * 1000) / 1000;
    }
    const paymentTotals = ['CASH', 'CARD', 'QR'].map((method) => {
        const entry = paymentMap.get(method) ?? { total: 0, count: 0 };
        return {
            method,
            label: method === 'CASH' ? 'Naqd' : method === 'CARD' ? 'Karta' : 'QR to\u2019lov',
            total: (0, serialize_1.round2)(entry.total),
            count: entry.count,
        };
    });
    const topProducts = [...productMap.entries()]
        .map(([productId, v]) => ({
        productId,
        name: v.name,
        quantity: Math.round(v.quantity * 1000) / 1000,
        revenue: (0, serialize_1.round2)(v.revenue),
    }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
    return {
        today: {
            revenue: (0, serialize_1.round2)(todayRevenue),
            profit: (0, serialize_1.round2)(todayProfit),
            itemsSold: Math.round(todayItems * 1000) / 1000,
            salesCount: todaySales.length,
        },
        inventory: {
            totalProducts,
            lowStockCount: lowStockItems.length,
            threshold,
            lowStockItems: lowStockItems.slice(0, 20).map(serialize_1.serializeProduct),
        },
        totals: { salesCount: totalSalesCount },
        week: days,
        payments: paymentTotals,
        topProducts,
        store: store ? (0, serialize_1.serializeStore)(store) : null,
    };
}
/** Hisobot: davr bo'yicha taqsimot (kun / to'lov turi / mahsulot) */
async function getSalesBreakdown(storeId, options) {
    const createdAt = (0, dates_1.parseDateRange)(options.from, options.to);
    const where = {
        storeId,
        ...(options.cashierId ? { cashierId: options.cashierId } : {}),
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    };
    const sales = await prisma_1.prisma.sale.findMany({
        where,
        include: { items: true, cashier: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
    });
    let revenue = 0;
    let profit = 0;
    let itemsSold = 0;
    for (const s of sales) {
        revenue += (0, serialize_1.num)(s.totalAmount);
        profit += (0, serialize_1.num)(s.profitAmount);
        itemsSold += (0, serialize_1.num)(s.itemCount);
    }
    if (options.groupBy === 'payment') {
        const map = new Map();
        for (const s of sales) {
            const label = s.paymentMethod === 'CASH' ? 'Naqd' : s.paymentMethod === 'CARD' ? 'Karta' : 'QR to\u2019lov';
            const e = map.get(s.paymentMethod) ?? { key: s.paymentMethod, label, revenue: 0, count: 0 };
            e.revenue += (0, serialize_1.num)(s.totalAmount);
            e.count += 1;
            map.set(s.paymentMethod, e);
        }
        return {
            summary: { revenue: (0, serialize_1.round2)(revenue), profit: (0, serialize_1.round2)(profit), itemsSold: round3(itemsSold), salesCount: sales.length },
            rows: [...map.values()].map((r) => ({ ...r, revenue: (0, serialize_1.round2)(r.revenue) })).sort((a, b) => b.revenue - a.revenue),
        };
    }
    if (options.groupBy === 'product') {
        const map = new Map();
        for (const s of sales) {
            for (const item of s.items) {
                const key = item.productId ?? item.productName;
                const e = map.get(key) ?? { key, label: item.productName, quantity: 0, revenue: 0, profit: 0 };
                const qty = (0, serialize_1.num)(item.quantity);
                e.quantity += qty;
                e.revenue += qty * (0, serialize_1.num)(item.price);
                e.profit += qty * ((0, serialize_1.num)(item.price) - (0, serialize_1.num)(item.unitCost));
                map.set(key, e);
            }
        }
        return {
            summary: { revenue: (0, serialize_1.round2)(revenue), profit: (0, serialize_1.round2)(profit), itemsSold: round3(itemsSold), salesCount: sales.length },
            rows: [...map.values()]
                .map((r) => ({
                ...r,
                quantity: round3(r.quantity),
                revenue: (0, serialize_1.round2)(r.revenue),
                profit: (0, serialize_1.round2)(r.profit),
            }))
                .sort((a, b) => b.revenue - a.revenue),
        };
    }
    // groupBy === 'day'
    const map = new Map();
    for (const s of sales) {
        const key = (0, dates_1.dayKey)(s.createdAt);
        const e = map.get(key) ?? { key, label: (0, dates_1.dayLabel)(s.createdAt), revenue: 0, profit: 0, count: 0 };
        e.revenue += (0, serialize_1.num)(s.totalAmount);
        e.profit += (0, serialize_1.num)(s.profitAmount);
        e.count += 1;
        map.set(key, e);
    }
    return {
        summary: { revenue: (0, serialize_1.round2)(revenue), profit: (0, serialize_1.round2)(profit), itemsSold: round3(itemsSold), salesCount: sales.length },
        rows: [...map.values()]
            .map((r) => ({ ...r, revenue: (0, serialize_1.round2)(r.revenue), profit: (0, serialize_1.round2)(r.profit) }))
            .sort((a, b) => a.key.localeCompare(b.key)),
    };
}
function round3(n) {
    return Math.round(n * 1000) / 1000;
}
/** Sotuvlar ro'yxati (filtrlar bilan) */
async function listSales(storeId, options) {
    const createdAt = (0, dates_1.parseDateRange)(options.from, options.to);
    const where = {
        storeId,
        ...(options.cashierId ? { cashierId: options.cashierId } : {}),
        ...(options.paymentMethod ? { paymentMethod: options.paymentMethod } : {}),
        ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    };
    const [total, sales] = await Promise.all([
        prisma_1.prisma.sale.count({ where }),
        prisma_1.prisma.sale.findMany({
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
    const all = await prisma_1.prisma.sale.findMany({
        where,
        select: { totalAmount: true, profitAmount: true, itemCount: true },
    });
    const summary = all.reduce((acc, s) => {
        acc.revenue += (0, serialize_1.num)(s.totalAmount);
        acc.profit += (0, serialize_1.num)(s.profitAmount);
        acc.itemsSold += (0, serialize_1.num)(s.itemCount);
        return acc;
    }, { revenue: 0, profit: 0, itemsSold: 0 });
    return {
        total,
        page: options.page,
        limit: options.limit,
        pages: Math.max(1, Math.ceil(total / options.limit)),
        summary: {
            revenue: (0, serialize_1.round2)(summary.revenue),
            profit: (0, serialize_1.round2)(summary.profit),
            itemsSold: round3(summary.itemsSold),
            salesCount: all.length,
        },
        items: sales,
    };
}
//# sourceMappingURL=report.service.js.map