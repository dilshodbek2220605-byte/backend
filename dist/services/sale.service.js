"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSale = createSale;
const prisma_1 = require("../lib/prisma");
const serialize_1 = require("../lib/serialize");
const error_1 = require("../middleware/error");
const saleInclude = {
    items: true,
    cashier: { select: { id: true, name: true, username: true } },
};
function round3(n) {
    return Math.round(n * 1000) / 1000;
}
/**
 * Sotuvni yaratish - HAMMASI bitta tranzaksiyada:
 *   1. Mahsulotlar do'konga tegishli ekanini tekshirish
 *   2. Omborni atomik kamaytirish (stock >= miqdor sharti bilan)
 *   3. Sale + SaleItem yozuvlarini yaratish
 *
 * Agar biror qadam xato bersa - hammasi bekor bo'ladi (rollback),
 * ya'ni ombor bilan chek hech qachon bir-biriga mos kelmay qolmaydi.
 */
async function createSale(input) {
    // ---- Idempotentlik: oflayn navbatdagi chek ikki marta yuborilsa ----
    if (input.clientRef) {
        const existing = await prisma_1.prisma.sale.findUnique({
            where: { clientRef: input.clientRef },
            include: saleInclude,
        });
        if (existing) {
            return { sale: (0, serialize_1.serializeSale)(existing), duplicated: true };
        }
    }
    if (!input.items || input.items.length === 0) {
        throw (0, error_1.badRequest)("Savat bo'sh - mahsulot qo'shing", 'EMPTY_CART');
    }
    // Bir xil mahsulot bir necha marta skanerlangan bo'lsa - qo'shib yuboramiz
    const merged = new Map();
    for (const item of input.items) {
        if (!item?.productId)
            throw (0, error_1.badRequest)("Mahsulot ID ko'rsatilmagan", 'INVALID_ITEM');
        const qty = Number(item.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
            throw (0, error_1.badRequest)("Miqdor 0 dan katta bo'lishi kerak", 'INVALID_QUANTITY');
        }
        merged.set(item.productId, round3((merged.get(item.productId) ?? 0) + qty));
    }
    const products = await prisma_1.prisma.product.findMany({
        where: { id: { in: [...merged.keys()] }, storeId: input.storeId },
        select: { id: true, name: true, barcode: true, unit: true, price: true, costPrice: true, isActive: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    const missing = [...merged.keys()].filter((id) => !byId.has(id));
    if (missing.length > 0) {
        throw (0, error_1.notFoundErr)(`${missing.length} ta mahsulot topilmadi`, 'PRODUCT_NOT_FOUND');
    }
    const lines = [];
    let totalAmount = 0;
    let profitAmount = 0;
    let itemCount = 0;
    for (const [productId, quantity] of merged) {
        const p = byId.get(productId);
        if (!p.isActive) {
            throw (0, error_1.conflict)(`${p.name} sotuvdan chiqarilgan`, 'PRODUCT_INACTIVE', { productId });
        }
        const price = (0, serialize_1.num)(p.price);
        const unitCost = (0, serialize_1.num)(p.costPrice);
        totalAmount += (0, serialize_1.round2)(price * quantity);
        profitAmount += (0, serialize_1.round2)((price - unitCost) * quantity);
        itemCount += quantity;
        lines.push({
            productId,
            productName: p.name,
            barcode: p.barcode,
            unit: p.unit,
            quantity,
            price,
            unitCost,
        });
    }
    totalAmount = (0, serialize_1.round2)(totalAmount);
    profitAmount = (0, serialize_1.round2)(profitAmount);
    itemCount = round3(itemCount);
    // ---- To'lov tekshiruvi ----
    let amountPaid;
    if (input.paymentMethod === 'CASH') {
        amountPaid = input.amountPaid != null ? Number(input.amountPaid) : totalAmount;
        if (!Number.isFinite(amountPaid) || amountPaid < totalAmount) {
            throw (0, error_1.badRequest)("Naqd pul yetarli emas", 'INSUFFICIENT_PAYMENT');
        }
    }
    else {
        amountPaid = totalAmount;
    }
    const changeAmount = (0, serialize_1.round2)(Math.max(0, amountPaid - totalAmount));
    try {
        const sale = await prisma_1.prisma.$transaction(async (tx) => {
            // Omborni atomik kamaytirish - har bir qator uchun
            for (const line of lines) {
                const updated = await tx.product.updateMany({
                    where: { id: line.productId, storeId: input.storeId, stock: { gte: line.quantity } },
                    data: { stock: { decrement: line.quantity } },
                });
                if (updated.count === 0) {
                    const fresh = await tx.product.findUnique({
                        where: { id: line.productId },
                        select: { stock: true },
                    });
                    throw (0, error_1.conflict)(`Omborda yetarli emas: ${line.productName}`, 'INSUFFICIENT_STOCK', {
                        productId: line.productId,
                        name: line.productName,
                        available: (0, serialize_1.num)(fresh?.stock),
                        requested: line.quantity,
                        unit: line.unit,
                    });
                }
            }
            return tx.sale.create({
                data: {
                    storeId: input.storeId,
                    cashierId: input.cashierId,
                    totalAmount,
                    profitAmount,
                    itemCount,
                    paymentMethod: input.paymentMethod,
                    amountPaid,
                    changeAmount,
                    note: input.note?.trim() ? input.note.trim() : null,
                    clientRef: input.clientRef ?? null,
                    items: { create: lines },
                },
                include: saleInclude,
            });
        });
        return { sale: (0, serialize_1.serializeSale)(sale), duplicated: false };
    }
    catch (err) {
        // Ikki ilova bir vaqtda bir xil clientRef yubordi -> mavjudini qaytaramiz
        const code = err.code;
        if (code === 'P2002' && input.clientRef) {
            const existing = await prisma_1.prisma.sale.findUnique({
                where: { clientRef: input.clientRef },
                include: saleInclude,
            });
            if (existing)
                return { sale: (0, serialize_1.serializeSale)(existing), duplicated: true };
        }
        throw err;
    }
}
//# sourceMappingURL=sale.service.js.map