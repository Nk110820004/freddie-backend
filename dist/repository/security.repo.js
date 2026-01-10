"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityRepository = exports.SecurityRepository = void 0;
const database_1 = require("../database");
class SecurityRepository {
    // ---- IP ALLOWLIST ----
    async getAllowlist() {
        return database_1.prisma.ipAllowlist.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async addIP(ip, description) {
        return database_1.prisma.ipAllowlist.create({
            data: {
                ip,
                description: description || null,
            },
        });
    }
    async removeIP(id) {
        return database_1.prisma.ipAllowlist.delete({
            where: { id },
        });
    }
    async toggleIP(id, isActive) {
        return database_1.prisma.ipAllowlist.update({
            where: { id },
            data: { isActive },
        });
    }
    // ---- API KEYS ----
    async getActiveApiKeys() {
        return database_1.prisma.apiKey.findMany({
            where: { isActive: true },
        });
    }
}
exports.SecurityRepository = SecurityRepository;
exports.securityRepository = new SecurityRepository();
//# sourceMappingURL=security.repo.js.map