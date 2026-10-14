// Prisma konfiguratsiyasi (Prisma 6.19+, Prisma 7 talab qiladi).
// `package.json#prisma` o'rniga ishlatiladi -- seed va migratsiya sozlamalari shu yerda.
//
// Muhim: prisma.config.ts ishlatilganda .env avtomatik yuklanmaydi,
// shuning uchun `dotenv/config` birinchi bo'lib import qilinadi.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Ma'lumotlar bazasi manzili endilikda shu yerda ham ko'rsatiladi.
  datasource: {
    url: env('DATABASE_URL'),
  },
});
