"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeyRepository = exports.ApiKeyRepository = void 0;
const database_1 = require("../database");
class ApiKeyRepository {
    async create(data) {
        return database_1.prisma.apiKey.create({
            data,
        });
    }
    async getById(id) {
        return database_1.prisma.apiKey.findUnique({
            where: { id },
        });
    }
    async getActiveKeys() {
        return database_1.prisma.apiKey.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async getByOutlet(outletId) {
        return database_1.prisma.apiKey.findMany({
            where: { outletId },
        });
    }
    async revoke(id) {
        return database_1.prisma.apiKey.update({
            where: { id },
            data: { isActive: false },
        });
    }
    async rotate(oldId, newKeyHash, expiresAt) {
        const old = await database_1.prisma.apiKey.update({
            where: { id: oldId },
            data: { isActive: false },
        });
        return database_1.prisma.apiKey.create({
            data: {
                keyHash: newKeyHash,
                outletId: old.outletId,
                userId: old.userId,
                expiresAt,
            },
        });
    }
    async getExpiringSoon(days = 30) {
        const threshold = new Date(Date.now() + days * 86400000);
        return database_1.prisma.apiKey.findMany({
            where: {
                expiresAt: { lte: threshold },
                isActive: true,
            },
        });
    }
    async getAll() {
        return database_1.prisma.apiKey.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
}
exports.ApiKeyRepository = ApiKeyRepository;
exports.apiKeyRepository = new ApiKeyRepository();
//# sourceMappingURL=api-key.repo.js.map