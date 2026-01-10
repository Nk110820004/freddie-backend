"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshTokensRepository = exports.RefreshTokensRepository = void 0;
const database_1 = require("../database");
class RefreshTokensRepository {
    async create(tokenHash, userId, expiresAt) {
        return database_1.prisma.refreshToken.create({
            data: {
                tokenHash,
                userId,
                expiresAt,
            },
        });
    }
    async findByHash(tokenHash) {
        return database_1.prisma.refreshToken.findUnique({ where: { tokenHash } });
    }
    async deleteByHash(tokenHash) {
        return database_1.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    async deleteByUserId(userId) {
        return database_1.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    async pruneExpired() {
        return database_1.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
}
exports.RefreshTokensRepository = RefreshTokensRepository;
exports.refreshTokensRepository = new RefreshTokensRepository();
//# sourceMappingURL=refreshTokens.repo.js.map