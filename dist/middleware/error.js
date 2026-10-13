"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.conflict = exports.notFoundErr = exports.forbidden = exports.unauthorized = exports.badRequest = exports.ApiError = void 0;
exports.notFoundHandler = notFoundHandler;
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, message, code = 'ERROR', details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
exports.ApiError = ApiError;
const badRequest = (msg, code = 'BAD_REQUEST', details) => new ApiError(400, msg, code, details);
exports.badRequest = badRequest;
const unauthorized = (msg = 'Avtorizatsiya kerak') => new ApiError(401, msg, 'UNAUTHORIZED');
exports.unauthorized = unauthorized;
const forbidden = (msg = "Ruxsat yo'q") => new ApiError(403, msg, 'FORBIDDEN');
exports.forbidden = forbidden;
const notFoundErr = (msg, code = 'NOT_FOUND') => new ApiError(404, msg, code);
exports.notFoundErr = notFoundErr;
const conflict = (msg, code = 'CONFLICT', details) => new ApiError(409, msg, code, details);
exports.conflict = conflict;
function notFoundHandler(_req, res) {
    res.status(404).json({ message: "So'ralgan manzil topilmadi", code: 'ROUTE_NOT_FOUND' });
}
function errorHandler(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            message: "Ma'lumotlar noto'g'ri kiritilgan",
            code: 'VALIDATION_ERROR',
            details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        });
        return;
    }
    if (err instanceof ApiError) {
        res.status(err.status).json({ message: err.message, code: err.code, details: err.details });
        return;
    }
    // Prisma unique constraint (P2002) kabi xatolar
    const anyErr = err;
    if (anyErr?.code === 'P2002') {
        const target = anyErr.meta?.target?.join(', ') ?? 'maydon';
        res.status(409).json({
            message: `Bu qiymat allaqachon mavjud (${target})`,
            code: 'DUPLICATE',
        });
        return;
    }
    if (anyErr?.code === 'P2025') {
        res.status(404).json({ message: 'Yozuv topilmadi', code: 'NOT_FOUND' });
        return;
    }
    // Noto'g'ri JSON yuborilganda (express.json parse xatosi)
    if (err instanceof SyntaxError && 'body' in err) {
        res.status(400).json({ message: "JSON noto'g'ri formatda", code: 'INVALID_JSON' });
        return;
    }
    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd)
        console.error('[xato]', err);
    res.status(500).json({
        message: "Serverda kutilmagan xatolik yuz berdi",
        code: 'INTERNAL_ERROR',
        ...(isProd ? {} : { details: anyErr?.message }),
    });
}
//# sourceMappingURL=error.js.map