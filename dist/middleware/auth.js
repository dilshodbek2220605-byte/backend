"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireRole = requireRole;
const prisma_1 = require("../lib/prisma");
const error_1 = require("./error");
const jwt_1 = require("../utils/jwt");
/**
 * JWT ni tekshiradi VA foydalanuvchi hali ham aktivligini bazadan biladi.
 * Bu muhim: admin kassirni o'chirsa, uning tokeni darhol ishlamaydi.
 * Shuningdek storeId har doim bazadan olinadi -> tenant izolyatsiyasi buzilmaydi.
 */
async function requireAuth(req, _res, next) {
    try {
        const header = req.headers.authorization ?? '';
        const [scheme, token] = header.split(' ');
        if (scheme !== 'Bearer' || !token)
            throw (0, error_1.unauthorized)("Token yuborilmagan");
        let payload;
        try {
            payload = (0, jwt_1.verifyToken)(token);
        }
        catch {
            throw (0, error_1.unauthorized)('Token yaroqsiz yoki muddati tugagan');
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: payload.sub },
            select: { id: true, storeId: true, role: true, username: true, name: true, isActive: true },
        });
        if (!user)
            throw (0, error_1.unauthorized)('Foydalanuvchi topilmadi');
        if (!user.isActive)
            throw (0, error_1.forbidden)('Hisobingiz faolsizlantirilgan');
        req.user = {
            id: user.id,
            storeId: user.storeId,
            role: user.role,
            username: user.username,
            name: user.name,
        };
        next();
    }
    catch (err) {
        next(err);
    }
}
function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.user)
            return next((0, error_1.unauthorized)());
        if (!roles.includes(req.user.role)) {
            return next((0, error_1.forbidden)('Bu amal uchun sizda huquq yo\u2019q'));
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map