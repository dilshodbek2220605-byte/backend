"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.num = num;
exports.numOrNull = numOrNull;
exports.strOrNull = strOrNull;
exports.serializeStore = serializeStore;
exports.serializeUser = serializeUser;
exports.serializeProduct = serializeProduct;
exports.serializeSaleItem = serializeSaleItem;
exports.serializeSale = serializeSale;
exports.round2 = round2;
/**
 * Prisma Decimal -> oddiy JavaScript number.
 * Bazada pul Decimal(14,2) turida saqlanadi (aniqlik uchun),
 * lekin API javobida har doim raqam qaytaramiz.
 */
function num(value) {
    if (value === null || value === undefined)
        return 0;
    if (typeof value === 'number')
        return value;
    const n = Number(value.toString());
    return Number.isNaN(n) ? 0 : n;
}
function numOrNull(value) {
    if (value === null || value === undefined)
        return null;
    return num(value);
}
function strOrNull(value) {
    if (value === null || value === undefined)
        return null;
    return String(value);
}
function serializeStore(store) {
    return {
        id: store.id,
        name: store.name,
        phone: store.phone,
        address: store.address ?? null,
        currency: store.currency,
        lowStockThreshold: store.lowStockThreshold,
    };
}
function serializeUser(user) {
    return {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        ...(user.store ? { store: serializeStore(user.store) } : {}),
    };
}
function serializeProduct(p) {
    return {
        id: p.id,
        barcode: p.barcode,
        name: p.name,
        category: p.category,
        unit: p.unit,
        price: num(p.price),
        costPrice: numOrNull(p.costPrice),
        stock: num(p.stock),
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt ?? p.createdAt,
    };
}
function serializeSaleItem(i) {
    const quantity = num(i.quantity);
    const price = num(i.price);
    const unitCost = num(i.unitCost);
    return {
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        barcode: i.barcode,
        unit: i.unit,
        quantity,
        price,
        unitCost,
        lineTotal: round2(quantity * price),
        lineProfit: round2(quantity * (price - unitCost)),
    };
}
function serializeSale(sale) {
    return {
        id: sale.id,
        totalAmount: num(sale.totalAmount),
        profitAmount: num(sale.profitAmount),
        itemCount: num(sale.itemCount),
        paymentMethod: sale.paymentMethod,
        amountPaid: numOrNull(sale.amountPaid),
        changeAmount: numOrNull(sale.changeAmount),
        note: sale.note,
        clientRef: sale.clientRef,
        createdAt: sale.createdAt,
        cashier: sale.cashier
            ? { id: sale.cashier.id, name: sale.cashier.name, username: sale.cashier.username }
            : null,
        ...(sale.items ? { items: sale.items.map(serializeSaleItem) } : {}),
    };
}
function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}
//# sourceMappingURL=serialize.js.map