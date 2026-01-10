"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.twoFAService = void 0;
const speakeasy_1 = __importDefault(require("speakeasy"));
const qrcode_1 = __importDefault(require("qrcode"));
class TwoFAService {
    async generateSecret(email) {
        const secret = speakeasy_1.default.generateSecret({
            name: `Freddy Admin Panel (${email})`,
            length: 32,
        });
        const qrCode = await qrcode_1.default.toDataURL(secret.otpauth_url);
        const backupCodes = Array.from({ length: 5 }).map(() => Math.random().toString(36).slice(-10));
        return { secret: secret.base32, qrCode, backupCodes };
    }
    verifyToken(secret, token) {
        const valid = speakeasy_1.default.totp.verify({
            secret,
            token,
            window: 1,
        });
        return { valid };
    }
}
exports.twoFAService = new TwoFAService();
//# sourceMappingURL=twofa.service.js.map