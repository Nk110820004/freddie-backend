"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleConnectTokenRepository = exports.GoogleConnectTokenRepository = void 0;
const database_1 = require("../database");
class GoogleConnectTokenRepository {
    /**
     * Create a new connect token
     */
    async create(data) {
        return database_1.prisma.googleConnectToken.create({
            data
        });
    }
    /**
     * Find token by token string
     */
    async findByToken(token) {
        return database_1.prisma.googleConnectToken.findUnique({
            where: { token },
            include: { outlet: true }
        });
    }
    /**
     * Find tokens by outlet ID
     */
    async findByOutletId(outletId) {
        return database_1.prisma.googleConnectToken.findMany({
            where: { outletId },
            orderBy: { createdAt: 'desc' }
        });
    }
    /**
     * Mark token as used
     */
    async markAsUsed(token) {
        return database_1.prisma.googleConnectToken.update({
            where: { token },
            data: { usedAt: new Date() }
        });
    }
    /**
     * Delete expired tokens
     */
    async deleteExpired() {
        const result = await database_1.prisma.googleConnectToken.deleteMany({
            where: {
                expiresAt: { lt: new Date() },
                usedAt: null
            }
        });
        return result.count;
    }
    /**
     * Clean up old used tokens (older than 30 days)
     */
    async cleanupOldTokens() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const result = await database_1.prisma.googleConnectToken.deleteMany({
            where: {
                usedAt: { lt: thirtyDaysAgo }
            }
        });
        return result.count;
    }
}
exports.GoogleConnectTokenRepository = GoogleConnectTokenRepository;
exports.googleConnectTokenRepository = new GoogleConnectTokenRepository();
//# sourceMappingURL=google-connect-token.repo.js.map