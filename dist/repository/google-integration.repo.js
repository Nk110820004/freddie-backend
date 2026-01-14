"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleIntegrationRepository = exports.GoogleIntegrationRepository = void 0;
const database_1 = require("../database");
class GoogleIntegrationRepository {
    /**
     * Create a new Google integration for an outlet
     */
    async create(data) {
        return database_1.prisma.googleIntegration.create({
            data
        });
    }
    /**
     * Find integration by outlet ID
     */
    async findByOutletId(outletId) {
        return database_1.prisma.googleIntegration.findUnique({
            where: { outletId }
        });
    }
    /**
     * Update refresh token for an outlet
     */
    async updateRefreshToken(outletId, refreshToken) {
        return database_1.prisma.googleIntegration.update({
            where: { outletId },
            data: { refreshToken }
        });
    }
    /**
     * Delete integration for an outlet
     */
    async deleteByOutletId(outletId) {
        try {
            return await database_1.prisma.googleIntegration.delete({
                where: { outletId }
            });
        }
        catch {
            return null;
        }
    }
    /**
     * Get all integrations
     */
    async getAll() {
        return database_1.prisma.googleIntegration.findMany({
            include: { outlet: true },
            orderBy: { connectedAt: 'desc' }
        });
    }
}
exports.GoogleIntegrationRepository = GoogleIntegrationRepository;
exports.googleIntegrationRepository = new GoogleIntegrationRepository();
//# sourceMappingURL=google-integration.repo.js.map