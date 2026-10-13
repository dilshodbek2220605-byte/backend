/**
 * Sana yordamchilari.
 * Barchasi SERVERNING MAHALLIY vaqti bo'yicha hisoblanadi, shuning uchun
 * "bugungi tushum" do'kon joylashgan vaqtga mos keladi.
 */

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/** 'YYYY-MM-DD' (mahalliy vaqt bo'yicha) */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'DD.MM' ko'rinishidagi qisqa yorliq (grafik uchun) */
export function dayLabel(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}.${m}`;
}

/**
 * Query parametrlaridan sana oralig'ini yasaydi.
 * `to` kuni TO'LIQ kun hisobga olinadi (23:59:59.999 gacha).
 */
export function parseDateRange(from?: string, to?: string): { gte?: Date; lte?: Date } {
  const range: { gte?: Date; lte?: Date } = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.gte = startOfDay(d);
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) range.lte = endOfDay(d);
  }
  return range;
}
