"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
class EncryptionService {
    constructor() {
        this.ALGO = 'aes-256-gcm';
        if (!process.env.ENCRYPTION_KEY) {
            throw new Error('ENCRYPTION_KEY env variable is required');
        }
        this.KEY = crypto_1.default
            .createHash('sha256')
            .update(process.env.ENCRYPTION_KEY)
            .digest();
    }
    encryptToJson(plain) {
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(this.ALGO, this.KEY, iv);
        const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return JSON.stringify({
            iv: iv.toString('hex'),
            value: encrypted.toString('hex'),
            tag: authTag.toString('hex'),
        });
    }
    decryptFromJson(payload) {
        const data = JSON.parse(payload);
        const decipher = crypto_1.default.createDecipheriv(this.ALGO, this.KEY, Buffer.from(data.iv, 'hex'));
        decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(data.value, 'hex')),
            decipher.final(),
        ]);
        return decrypted.toString('utf8');
    }
}
exports.encryptionService = new EncryptionService();
//# sourceMappingURL=encryption.service.js.map