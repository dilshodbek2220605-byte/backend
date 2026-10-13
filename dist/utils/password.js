"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.generatePassword = generatePassword;
exports.slugifyUsername = slugifyUsername;
exports.uniqueUsername = uniqueUsername;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const node_crypto_1 = __importDefault(require("node:crypto"));
function hashPassword(plain) {
    return bcryptjs_1.default.hash(plain, 10);
}
function comparePassword(plain, hash) {
    return bcryptjs_1.default.compare(plain, hash);
}
/**
 * O'qish oson parol generatsiyasi.
 * Chalkashadigan belgilar (0/O, 1/l/I) ataylab chiqarib tashlangan -
 * kassir qo'lda terishi mumkin.
 */
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generatePassword(length = 8) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += PASSWORD_ALPHABET[node_crypto_1.default.randomInt(0, PASSWORD_ALPHABET.length)];
    }
    return out;
}
/**
 * Ism-familiyadan username yasash: "Aziza Karimova" -> "aziza"
 * Kirill/o'zbek harflari ham lotinchaga o'giriladi.
 */
const TRANSLIT = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
    ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h', ʼ: '', "'": '',
};
function slugifyUsername(raw) {
    const lowered = raw.toLowerCase().trim();
    let out = '';
    for (const ch of lowered) {
        if (TRANSLIT[ch] !== undefined) {
            out += TRANSLIT[ch];
        }
        else if (/[a-z0-9]/.test(ch)) {
            out += ch;
        }
        else if (/\s|[-_.]/.test(ch)) {
            out += ' ';
        }
    }
    const first = out.trim().split(/\s+/)[0] ?? '';
    const clean = first.replace(/[^a-z0-9]/g, '');
    return clean.length >= 3 ? clean.slice(0, 20) : 'kassir';
}
/** Mavjudlar ro'yxatini hisobga olib unikal username yasaydi: aziza, aziza2, aziza3 ... */
function uniqueUsername(base, taken) {
    const set = new Set(taken.map((t) => t.toLowerCase()));
    if (!set.has(base))
        return base;
    let i = 2;
    while (set.has(`${base}${i}`))
        i += 1;
    return `${base}${i}`;
}
//# sourceMappingURL=password.js.map