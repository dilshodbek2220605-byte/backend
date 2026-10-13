import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './lib/prisma';
import { ensureBootstrap } from './boot';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth.routes';
import productsRoutes from './routes/products.routes';
import reportsRoutes from './routes/reports.routes';
import salesRoutes from './routes/sales.routes';
import usersRoutes from './routes/users.routes';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const isProd = process.env.NODE_ENV === 'production';

// Telefonda LAN orqali ochilganda ham ishlashi uchun origin tekshiruvi yumshoq
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(
  cors({
    origin(origin, callback) {
      // Origin yo'q (mobil brauzer/curl) yoki dev rejimi -> ruxsat
      if (!origin || !isProd || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
if (!isProd) app.use(morgan('dev'));

/** Sog'liq tekshiruvi (server + baza) */
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'unreachable', message: (err as Error).message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportsRoutes);

// Frontend build (production / Railway): tayyor client'ni ham bitta portda xizmat qilamiz.
// Vite build natijasi <root>/client/dist da yotadi (npm run build).
const clientDist = path.resolve(__dirname, '../../client/dist');
const clientHtml = path.join(clientDist, 'index.html');
if (fs.existsSync(clientHtml)) {
  app.use(
    express.static(clientDist, {
      maxAge: '7d',
      setHeaders(res, filePath) {
        // index.html doim yangi yuklansin (hash'li assetlar esa uzoq cache bilan)
        if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );

  // SPA fallback: /kirish, /kassa, /admin... marshrutlari uchun index.html qaytariladi.
  // /api va /health so'rovlari notFound/error handler'larga boradi.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(clientHtml);
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

let server: ReturnType<typeof app.listen>;

async function main(): Promise<void> {
  // Bo'sh bazani tayyorlash: do'kon, admin/kassirlar, mahsulotlar (idempotent).
  try {
    await ensureBootstrap();
    console.log("  ✔ Boshlang'ich ma'lumotlar tayyor (do'kon, foydalanuvchilar, mahsulotlar)");
  } catch (err) {
    const message = (err as Error).message || String(err);
    if (isProd) {
      console.error('  ⚠️  Baza tayyorlashda xatolik:', message);
      console.error('     DATABASE_URL sozlamasini tekshiring (Railway → Variables).');
    } else {
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

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} - server to'xtatilmoqda...`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
