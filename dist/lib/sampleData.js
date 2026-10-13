"use strict";
/**
 * Namuna (demo) ma'lumotlar.
 *
 * Birdan ortiq joyda ishlatiladi:
 *  - prisma/seed.ts  (npm run db:seed — ishlab chiqish uchun)
 *  - src/boot.ts     (Railway/ishlab chiqarishda server birinchi marta ochilganda
 *                     bo'sh bazani tayyorlaydi: do'kon, admin/kassirlar, mahsulotlar)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE = exports.PRODUCTS = void 0;
exports.ean13 = ean13;
/** EAN-13 nazorat raqamini hisoblash (haqiqiy skanerlar o'qiy oladigan kod) */
function ean13(prefix12) {
    const digits = prefix12.split('').map(Number);
    const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
    const check = (10 - (sum % 10)) % 10;
    return `${prefix12}${check}`;
}
const RAW_PRODUCTS = [
    { name: 'Non (obi non)', category: 'Non mahsulotlari', unit: 'dona', price: 4000, costPrice: 2800, stock: 60 },
    { name: 'Sut "MilkPro" 1L', category: 'Sut mahsulotlari', unit: 'litr', price: 14000, costPrice: 11000, stock: 40 },
    { name: 'Tuxum 10 dona', category: 'Sut mahsulotlari', unit: 'quti', price: 22000, costPrice: 18000, stock: 30 },
    { name: 'Guruch "Lazer" 1kg', category: 'Don mahsulotlari', unit: 'kg', price: 18000, costPrice: 14000, stock: 50 },
    { name: "Paxta yog'i 1L", category: "Yog' mahsulotlari", unit: 'litr', price: 28000, costPrice: 24000, stock: 25 },
    { name: 'Shakar 1kg', category: 'Don mahsulotlari', unit: 'kg', price: 13000, costPrice: 10500, stock: 45 },
    { name: 'Choy "Ahmad" 100g', category: 'Ichimliklar', unit: 'paket', price: 25000, costPrice: 20000, stock: 20 },
    { name: 'Makaron 400g', category: 'Don mahsulotlari', unit: 'paket', price: 9000, costPrice: 6800, stock: 55 },
    { name: 'Osh tuzi 1kg', category: 'Ziravorlar', unit: 'paket', price: 3000, costPrice: 2000, stock: 70 },
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
    { name: 'Shampun "Head & Shoulders"', category: 'Gigiyena', unit: 'dona', price: 55000, costPrice: 44000, stock: 10 },
    { name: 'Sabzi 1kg', category: 'Sabzavotlar', unit: 'kg', price: 8000, costPrice: 5500, stock: 3 },
    { name: 'Kartoshka 1kg', category: 'Sabzavotlar', unit: 'kg', price: 7000, costPrice: 4500, stock: 80 },
    { name: 'Piyoz 1kg', category: 'Sabzavotlar', unit: 'kg', price: 6000, costPrice: 4000, stock: 65 },
    { name: "Muzlatilgan tovuq 1kg", category: "Go'sht mahsulotlari", unit: 'kg', price: 42000, costPrice: 35000, stock: 9 },
    { name: 'Banan 1kg', category: 'Mevalar', unit: 'kg', price: 28000, costPrice: 22000, stock: 4 },
];
exports.PRODUCTS = RAW_PRODUCTS.map((p, i) => ({
    ...p,
    barcode: ean13(`2000000${String(i + 1).padStart(5, '0')}`),
}));
exports.STORE = {
    name: 'Shablon Do\u2019kon',
    phone: '+998 90 123 45 67',
    address: 'Toshkent sh., Chilonzor tumani',
    currency: 'UZS',
    lowStockThreshold: 5,
};
//# sourceMappingURL=sampleData.js.map