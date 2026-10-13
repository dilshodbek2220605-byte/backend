"use strict";
/**
 * Sana yordamchilari.
 * Barchasi SERVERNING MAHALLIY vaqti bo'yicha hisoblanadi, shuning uchun
 * "bugungi tushum" do'kon joylashgan vaqtga mos keladi.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOfDay = startOfDay;
exports.endOfDay = endOfDay;
exports.addDays = addDays;
exports.dayKey = dayKey;
exports.dayLabel = dayLabel;
exports.parseDateRange = parseDateRange;
function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}
function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}
function addDays(d, days) {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
}
/** 'YYYY-MM-DD' (mahalliy vaqt bo'yicha) */
function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
/** 'DD.MM' ko'rinishidagi qisqa yorliq (grafik uchun) */
function dayLabel(d) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}.${m}`;
}
/**
 * Query parametrlaridan sana oralig'ini yasaydi.
 * `to` kuni TO'LIQ kun hisobga olinadi (23:59:59.999 gacha).
 */
function parseDateRange(from, to) {
    const range = {};
    if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime()))
            range.gte = startOfDay(d);
    }
    if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime()))
            range.lte = endOfDay(d);
    }
    return range;
}
//# sourceMappingURL=dates.js.map