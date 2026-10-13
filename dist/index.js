"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const prisma_1 = require("./lib/prisma");
const boot_1 = require("./boot");
const error_1 = require("./middleware/error");
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const products_routes_1 = __importDefault(require("./routes/products.routes"));
const reports_routes_1 = __importDefault(require("./routes/reports.routes"));
const sales_routes_1 = __importDefault(require("./routes/sales.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT || 4000);
const isProd = process.env.NODE_ENV === 'production';
// Telefonda LAN orqali ochilganda ham ishlashi uchun origin tekshiruvi yumshoq
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
app.set('trust proxy', 1);
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: false }));
app.use((0, cors_1.default)({
    origin(origin, callback) {
        // Origin yo'q (mobil brauzer/curl) yoki dev rejimi -> ruxsat
        if (!origin || !isProd || allowedOrigins.includes(origin)) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: '2mb' }));
if (!isProd)
    app.use((0, morgan_1.default)('dev'));
/** Sog'liq tekshiruvi (server + baza) */
app.get('/health', async (_req, res) => {
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
    }
    catch (err) {
        res.status(503).json({ status: 'error', db: 'unreachable', message: err.message });
    }
});
app.use('/api/auth', auth_routes_1.default);
app.use('/api/products', products_routes_1.default);
app.use('/api/users', users_routes_1.default);
app.use('/api/sales', sales_routes_1.default);
app.use('/api/reports', reports_routes_1.default);
// Frontend build (production / Railway): tayyor client'ni ham bitta portda xizmat qilamiz.
// Vite build natijasi <root>/client/dist da yotadi (npm run build).
const clientDist = node_path_1.default.resolve(__dirname, '../../client/dist');
const clientHtml = node_path_1.default.join(clientDist, 'index.html');
if (node_fs_1.default.existsSync(clientHtml)) {
    app.use(express_1.default.static(clientDist, {
        maxAge: '7d',
        setHeaders(res, filePath) {
            // index.html doim yangi yuklansin (hash'li assetlar esa uzoq cache bilan)
            if (filePath.endsWith('index.html'))
                res.setHeader('Cache-Control', 'no-cache');
        },
    }));
    // SPA fallback: /kirish, /kassa, /admin... marshrutlari uchun index.html qaytariladi.
    // /api va /health so'rovlari notFound/error handler'larga boradi.
    app.get(/^\/(?!api\/).*/, (_req, res) => {
        res.sendFile(clientHtml);
    });
}
app.use(error_1.notFoundHandler);
app.use(error_1.errorHandler);
let server;
async function main() {
    // Bo'sh bazani tayyorlash: do'kon, admin/kassirlar, mahsulotlar (idempotent).
    try {
        await (0, boot_1.ensureBootstrap)();
        console.log("  ✔ Boshlang'ich ma'lumotlar tayyor (do'kon, foydalanuvchilar, mahsulotlar)");
    }
    catch (err) {
        const message = err.message || String(err);
        if (isProd) {
            console.error('  ⚠️  Baza tayyorlashda xatolik:', message);
            console.error('     DATABASE_URL sozlamasini tekshiring (Railway → Variables).');
        }
        else {
            console.error('  ⚠️  Baza hozircha yetib bo\'lmadi:', message);
            console.error('     Server ishga tushdi; /health dan holatni kuzating.');
        }
    }
    server = app.listen(PORT, '0.0.0.0', () => {
        console.log(`\n  🧾  Shablon POS API tayyor`);
        console.log(`  ➜  http://localhost:${PORT}/health`);
        console.log(`  ➜  Telefon uchun: http://<LAN-IP>:${PORT}\n`);
    });
}
void main();
async function shutdown(signal) {
    console.log(`\n${signal} - server to'xtatilmoqda...`);
    server.close(() => {
        void prisma_1.prisma.$disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
//# sourceMappingURL=index.js.map