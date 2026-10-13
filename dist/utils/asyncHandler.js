"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncHandler = asyncHandler;
/**
 * async route handler ichidagi xatolarni markaziy error handler ga uzatadi.
 * (Express 5 o'zi ham qila oladi, lekin bu har qanday holatda ishonchli.)
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
//# sourceMappingURL=asyncHandler.js.map