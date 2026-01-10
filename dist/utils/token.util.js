"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomToken = generateRandomToken;
exports.hashToken = hashToken;
exports.signAccessToken = signAccessToken;
exports.verifyAccessToken = verifyAccessToken;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = __importDefault(require("../config/env"));
function generateRandomToken(size = 48) {
    return crypto_1.default.randomBytes(size).toString('hex');
}
function hashToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
function signAccessToken(payload) {
    const secret = (process.env.JWT_ACCESS_SECRET || env_1.default.JWT_ACCESS_SECRET);
    const expiresIn = (process.env.JWT_ACCESS_EXPIRY || env_1.default.JWT_ACCESS_EXPIRY);
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn });
}
function verifyAccessToken(token) {
    const secret = process.env.JWT_ACCESS_SECRET || env_1.default.JWT_ACCESS_SECRET;
    return jsonwebtoken_1.default.verify(token, secret);
}
//# sourceMappingURL=token.util.js.map