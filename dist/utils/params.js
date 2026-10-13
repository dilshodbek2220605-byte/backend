"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.param = param;
/**
 * Express 5 da `req.params.x` turi `string | string[]` bo'lishi mumkin
 * (takrorlanuvchi parametrlar uchun). Bu yordamchi har doim bitta
 * toza string qaytaradi va TS ni xotirjam qiladi.
 */
function param(req, key) {
    const value = req.params[key];
    if (Array.isArray(value))
        return String(value[0] ?? '');
    return value === undefined || value === null ? '' : String(value);
}
//# sourceMappingURL=params.js.map