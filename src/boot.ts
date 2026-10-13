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
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';
import { PRODUCTS, STORE, type SampleProduct } from './lib/sampleData';

type Role = 'ADMIN' | 'CASHIER';

async function upsertUser(
  storeId: string,
  name: string,
  username: string,
  password: string,
  role: Role,
) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      storeId,
      name,
      username,
      passwordHash: await bcrypt.hash(password, 10),
      role,
    },
  });
}

export async function ensureBootstrap(): Promise<void> {
  // ---------- Do'kon ----------
  let store = await prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!store) {
    store = await prisma.store.create({ data: { ...STORE } });
    console.log(`  ✔ Do'kon yaratildi: ${store.name}`);
  }

  // ---------- Foydalanuvchilar ----------
  const admin = await upsertUser(store.id, 'Do\u2019kon Egasi', 'admin', 'admin123', 'ADMIN');
  const aziza = await upsertUser(store.id, 'Aziza Karimova', 'aziza', 'kassir123', 'CASHIER');
  const jasur = await upsertUser(store.id, 'Jasur Toshmatov', 'jasur', 'kassir123', 'CASHIER');
  console.log(`  ✔ Foydalanuvchilar: ${admin.username}, ${aziza.username}, ${jasur.username}`);

  // ---------- Mahsulotlar ----------
  const productCount = await prisma.product.count({ where: { storeId: store.id } });
  if (productCount === 0) {
    await prisma.product.createMany({
      data: PRODUCTS.map((p: SampleProduct) => ({
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
    console.log(`  ✔ ${PRODUCTS.length} ta mahsulot qo'shildi`);
  }
}