"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRepository = exports.AuthRepository = void 0;
const database_1 = require("../database");
class AuthRepository {
    async getUserByEmail(email) {
        return database_1.prisma.user.findFirst({
            where: {
                email: email.toLowerCase(),
                deletedAt: null,
            },
        });
    }
    async updateLastLogin(id, ip) {
        await database_1.prisma.user.update({
            where: { id },
            data: {
                lastLoginAt: new Date(),
                lastLoginIp: ip || null,
            },
        });
    }
    async saveTwoFactorSecret(id, secret) {
        await database_1.prisma.user.update({
            where: { id },
            data: {
                twoFactorSecret: secret,
                twoFactorEnabled: true,
                twoFactorVerified: true,
            },
        });
    }
}
exports.AuthRepository = AuthRepository;
exports.authRepository = new AuthRepository();
//# sourceMappingURL=auth.repo.js.map