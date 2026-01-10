"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipAllowlistRepository = exports.IpAllowlistRepository = void 0;
const database_1 = require("../database");
class IpAllowlistRepository {
    async isAllowed(ip) {
        const entry = await database_1.prisma.ipAllowlist.findFirst({
            where: {
                ip,
                isActive: true,
            },
        });
        return !!entry;
    }
    async getAll() {
        return database_1.prisma.ipAllowlist.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }
    async getById(id) {
        return database_1.prisma.ipAllowlist.findUnique({ where: { id } });
    }
    async getByIP(ip) {
        return database_1.prisma.ipAllowlist.findUnique({ where: { ip } });
    }
    async create(ip, description) {
        return database_1.prisma.ipAllowlist.create({
            data: {
                ip,
                description: description || null,
            },
        });
    }
    async delete(id) {
        return database_1.prisma.ipAllowlist.delete({ where: { id } });
    }
    async setStatus(id, isActive) {
        return database_1.prisma.ipAllowlist.update({
            where: { id },
            data: { isActive },
        });
    }
}
exports.IpAllowlistRepository = IpAllowlistRepository;
exports.ipAllowlistRepository = new IpAllowlistRepository();
//# sourceMappingURL=ip-allowlist.repo.js.map