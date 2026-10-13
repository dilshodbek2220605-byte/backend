"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function secret() {
    return process.env.JWT_SECRET || 'shablon-pos-dev-secret';
}
function signToken(payload) {
    const expiresIn = (process.env.JWT_EXPIRES_IN || '12h');
    return jsonwebtoken_1.default.sign(payload, secret(), { expiresIn });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, secret());
}
//# sourceMappingURL=jwt.js.map