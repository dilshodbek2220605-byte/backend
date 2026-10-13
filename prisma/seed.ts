/**
 * Demo ma'lumotlar (seed).
 *
 *   npm run db:seed
 *
 * Yaratadi: 1 do'kon, 1 admin, 2 kassir, 25 mahsulot va oxirgi 7 kunlik
 * namunali sotuvlar (boshqaruv paneli bo'sh ko'rinmasligi uchun).
 * Skript idempotent - ikki marta ishga tushirsangiz dublikat yaratmaydi.
 */
import { PrismaClient, type PaymentMethod } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/** EAN-13 nazorat raqamini hisoblash (haqiqiy skanerlar o'qiy oladigan kod) */
function ean13(prefix12: string): string {
  const digits = prefix12.split('').map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return `${prefix12}${check}`;
}

type SeedProduct = {
  barcode: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  costPrice: number | null;
  stock: number;
};

const PRODUCTS: SeedProduct[] = [
  { name: 'Non (obi non)', category: 'Non mahsulotlari', unit: 'dona', price: 4000, costPrice: 2800, stock: 60 },
  { name: 'Sut "MilkPro" 1L', category: 'Sut mahsulotlari', unit: 'litr', price: 14000, costPrice: 11000, stock: 40 },
  { name: 'Tuxum 10 dona', category: 'Sut mahsulotlari', unit: 'quti', price: 22000, costPrice: 18000, stock: 30 },
  { name: 'Guruch "Lazer" 1kg', category: 'Don mahsulotlari', unit: 'kg', price: 18000, costPrice: 14000, stock: 50 },
  { name: "Paxta yog'i 1L", category: "Yog' mahsulotlari", unit: 'litr', price: 28000, costPrice: 24000, stock: 25 },
  { name: 'Shakar 1kg', category: 'Don mahsulotlari', unit: 'kg', price: 13000, costPrice: 10500, stock: 45 },
  { name: 'Choy "Ahmad" 100g', category: 'Ichimliklar', unit: 'paket', price: 25000, costPrice: 20000, stock: 20 },
  { name: 'Makaron 400g', category: 'Don mahsulotlari', unit: 'paket', price: 9000, costPrice: 6800, stock: 55 },
  { name: "Osh tuzi 1kg", category: 'Ziravorlar', unit: 'paket', price: 3000, costPrice: 2000, stock: 70 },
  { name: 'Ichimlik suvi 1.5L', category: 'Ichimliklar', unit: 'dona', price: 5000, costPrice: 3500, stock: 100 },
  { name: 'Coca-Cola 1.5L', category: 'Ichimliklar', unit: 'dona', price: 16000, costPrice: 13500, stock: 48 },
  { name: 'Pishloq 250g', category: 'Sut mahsulotlari', unit: 'dona', price: 32000, costPrice: 27000, stock: 15 },
  { name: 'Kolbasa "Doktorskaya"', category: "Go'sht mahsulotlari", unit: 'kg', price: 65000, costPrice: 55000, stock: 12 },
  { name: 'Muzqaymoq "Bomond"', category: 'Muzqaymoqlar', unit: 'dona', price: 12000, costPrice: 8000, stock: 36 },
  { name: 'Shokolad "Alpen Gold"', category: 'Shirinliklar', unit: 'dona', price: 18000, costPrice: 14000, stock: 40 },
  { name: 'Pechene "Yubileynoe"', category: 'Shirinliklar', unit: 'paket', price: 15000, costPrice: 11000, stock: 25 },
  { name: 'Kir yuvish kukuni 3kg', category: 'Kimyoviy vositalar', unit: 'paket', price: 45000, costPrice: 37000, stock: 18 },
  { name: 'Sovun "Absolut"', category: 'Kimyoviy vositalar', unit: 'dona', price: 8000, costPrice: 5500, stock: 60 },
  { name: 'Tish pastasi "Colgate"', category: 'Gigiyena', unit: 'dona', price: 25000, costPrice: 19000, stock: 22 },
  { name: "Shampun \"Head & Shoulders\"", category: 'Gigiyena', unit: 'dona', price: 55000, costPrice: 44000, stock: 10 },
  { name: 'Sabzi 1kg', category: 'Sabzavotlar', unit: 'kg', price: 8000, costPrice: 5500, stock: 3 },
  { name: 'Kartoshka 1kg', category: 'Sabzavotlar', unit: 'kg', price: 7000, costPrice: 4500, stock: 80 },
  { name: 'Piyoz 1kg', category: 'Sabzavotlar', unit: 'kg', price: 6000, costPrice: 4000, stock: 65 },
  { name: "Muzlatilgan tovuq 1kg", category: "Go'sht mahsulotlari", unit: 'kg', price: 42000, costPrice: 35000, stock: 9 },
  { name: 'Banan 1kg', category: 'Mevalar', unit: 'kg', price: 28000, costPrice: 22000, stock: 4 },
].map((p, i) => ({ ...p, barcode: ean13(`2000000${String(i + 1).padStart(5, '0')}`) }));

const STORE = {
  name: 'Shablon Do\u2019kon',
  phone: '+998 90 123 45 67',
  address: 'Toshkent sh., Chilonzor tumani',
  currency: 'UZS',
  lowStockThreshold: 5,
};

async function upsertUser(
  storeId: string,
  name: string,
  username: string,
  password: string,
  role: 'ADMIN' | 'CASHIER',
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

async function main(): Promise<void> {
  console.log('🌱  Demo ma\u2019lumotlar yaratilmoqda...\n');

  // ---------- Do'kon ----------
  let store = await prisma.store.findFirst({ where: { name: STORE.name } });
  if (!store) {
    store = await prisma.store.create({ data: STORE });
    console.log(`  ✔ Do'kon yaratildi: ${store.name}`);
  } else {
    console.log(`  • Do'kon mavjud: ${store.name}`);
  }

  // ---------- Foydalanuvchilar ----------
  const admin = await upsertUser(store.id, 'Do\u2019kon Egasi', 'admin', 'admin123', 'ADMIN');
  const aziza = await upsertUser(store.id, 'Aziza Karimova', 'aziza', 'kassir123', 'CASHIER');
  const jasur = await upsertUser(store.id, 'Jasur Toshmatov', 'jasur', 'kassir123', 'CASHIER');
  console.log(`  ✔ Foydalanuvchilar: ${admin.username}, ${aziza.username}, ${jasur.username}`);

  // ---------- Mahsulotlar ----------
  const productCount = await prisma.product.count({ where: { storeId: store.id } });
  let products;
  if (productCount === 0) {
    await prisma.product.createMany({
      data: PRODUCTS.map((p) => ({
        storeId: store!.id,
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
  } else {
    console.log(`  • Mahsulotlar allaqachon mavjud (${productCount} ta)`);
  }
  products = await prisma.product.findMany({ where: { storeId: store.id } });

  // ---------- Namunali sotuvlar (oxirgi 7 kun) ----------
  const saleCount = await prisma.sale.count({ where: { storeId: store.id } });
  if (saleCount === 0 && products.length > 0) {
    const cashiers = [aziza, jasur];
    const paymentPool: PaymentMethod[] = ['CASH', 'CASH', 'CASH', 'CARD', 'CARD', 'QR'];
    let created = 0;

    for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
      const salesToday = 2 + Math.floor(Math.random() * 4); // 2..5 sotuv

      for (let n = 0; n < salesToday; n += 1) {
        const when = new Date();
        when.setDate(when.getDate() - dayOffset);
        when.setHours(8 + Math.floor(Math.random() * 13), Math.floor(Math.random() * 60), 0, 0);
        if (when.getTime() > Date.now()) when.setTime(Date.now() - 60_000);

        const lineCount = 1 + Math.floor(Math.random() * 4);
        const picked = new Set<number>();
        while (picked.size < lineCount) picked.add(Math.floor(Math.random() * products.length));

        const items = [...picked].map((idx) => {
          const p = products[idx]!;
          const isBulk = p.unit === 'kg' || p.unit === 'litr';
          const quantity = isBulk
            ? Math.round((0.5 + Math.random() * 2) * 2) / 2
            : 1 + Math.floor(Math.random() * 3);
          const price = Number(p.price);
          const unitCost = p.costPrice ? Number(p.costPrice) : 0;
          return {
            productId: p.id,
            productName: p.name,
            barcode: p.barcode,
            unit: p.unit,
            quantity,
            price,
            unitCost,
            lineTotal: Math.round(quantity * price * 100) / 100,
            lineProfit: Math.round(quantity * (price - unitCost) * 100) / 100,
          };
        });

        const totalAmount = Math.round(items.reduce((a, i) => a + i.lineTotal, 0) * 100) / 100;
        const profitAmount = Math.round(items.reduce((a, i) => a + i.lineProfit, 0) * 100) / 100;
        const itemCount = Math.round(items.reduce((a, i) => a + i.quantity, 0) * 1000) / 1000;
        const paymentMethod = paymentPool[Math.floor(Math.random() * paymentPool.length)]!;
        const amountPaid =
          paymentMethod === 'CASH' ? Math.ceil((totalAmount + Math.random() * 20000) / 1000) * 1000 : totalAmount;

        await prisma.sale.create({
          data: {
            storeId: store.id,
            cashierId: cashiers[Math.floor(Math.random() * cashiers.length)]!.id,
            totalAmount,
            profitAmount,
            itemCount,
            paymentMethod,
            amountPaid,
            changeAmount: Math.round((amountPaid - totalAmount) * 100) / 100,
            clientRef: `seed-${dayOffset}-${n}`,
            createdAt: when,
            items: {
              create: items.map(({ lineTotal, lineProfit, ...rest }) => rest),
            },
          },
        });
        created += 1;
      }
    }
    console.log(`  ✔ ${created} ta namunali sotuv qo'shildi (oxirgi 7 kun)`);
  } else {
    console.log(`  • Sotuvlar allaqachon mavjud (${saleCount} ta)`);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  🔑  KIRISH MA'LUMOTLARI                                      ║
╠══════════════════════════════════════════════════════════════╣
║  ADMIN    (ega)     admin   / admin123                        ║
║  KASSIR             aziza   / kassir123                        ║
║  KASSIR             jasur   / kassir123                        ║
╚══════════════════════════════════════════════════════════════╝
`);
  console.log('✅  Tayyor!\n');
}

main()
  .catch((err) => {
    console.error('❌ Seed xatosi:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
