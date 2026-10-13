import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { prisma } from './lib/prisma';
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

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🧾  Shablon POS API tayyor`);
  console.log(`  ➜  http://localhost:${PORT}/health`);
  console.log(`  ➜  Telefon uchun: http://<LAN-IP>:${PORT}\n`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} - server to'xtatilmoqda...`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
