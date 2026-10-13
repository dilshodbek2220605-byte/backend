"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureBootstrap = ensureBootstrap;
/**
 * Ishlab chiqarishda (Railway) bazani avtomatik tayyorlash.
 *
 * Server har startida chaqiriladi (index.ts):
 *  - Agar do'kon yo'q bo'lsa — yaratadi
 *  - Agar admin/kassirlar yo'q bo'lsa — yaratadi (admin / admin123, aziza / kassir123, jasur / kassir123)
 *  - Agar mahsulotlar bo'sh bo'lsa — 25 ta namuna mahsulot qo'shadi
 *
 * Hammasi IDEMPOTENT — necha marta ishga tushsa ham dublikat yaratmaydi.
 */
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = require("./lib/prisma");
const sampleData_1 = require("./lib/sampleData");
async function upsertUser(storeId, name, username, password, role) {
    const existing = await prisma_1.prisma.user.findUnique({ where: { username } });
    if (existing)
        return existing;
    return prisma_1.prisma.user.create({
        data: {
            storeId,
            name,
            username,
            passwordHash: await bcryptjs_1.default.hash(password, 10),
            role,
        },
    });
}
async function ensureBootstrap() {
    // ---------- Do'kon ----------
    let store = await prisma_1.prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!store) {
        store = await prisma_1.prisma.store.create({ data: { ...sampleData_1.STORE } });
        console.log(`  ✔ Do'kon yaratildi: ${store.name}`);
    }
    // ---------- Foydalanuvchilar ----------
    const admin = await upsertUser(store.id, 'Do\u2019kon Egasi', 'admin', 'admin123', 'ADMIN');
    const aziza = await upsertUser(store.id, 'Aziza Karimova', 'aziza', 'kassir123', 'CASHIER');
    const jasur = await upsertUser(store.id, 'Jasur Toshmatov', 'jasur', 'kassir123', 'CASHIER');
    console.log(`  ✔ Foydalanuvchilar: ${admin.username}, ${aziza.username}, ${jasur.username}`);
    // ---------- Mahsulotlar ----------
    const productCount = await prisma_1.prisma.product.count({ where: { storeId: store.id } });
    if (productCount === 0) {
        await prisma_1.prisma.product.createMany({
            data: sampleData_1.PRODUCTS.map((p) => ({
                storeId: store.id,
                barcode: p.barcode,
                name: p.name,
                category: p.category,
                unit: p.unit,
                price: p.price,
                costPrice: p.costPrice,
                stock: p.stock,
            })),
        });
        console.log(`  ✔ ${sampleData_1.PRODUCTS.length} ta mahsulot qo'shildi`);
    }
}
//# sourceMappingURL=boot.js.map