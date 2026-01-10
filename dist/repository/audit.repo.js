"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRepository = void 0;
exports.createAuditLog = createAuditLog;
exports.getAuditLogsForUser = getAuditLogsForUser;
exports.getAuditLogsForEntity = getAuditLogsForEntity;
exports.getAuditLogsForAction = getAuditLogsForAction;
exports.getRecentAuditLogs = getRecentAuditLogs;
exports.getSensitiveActions = getSensitiveActions;
exports.getAuditLogsByDateRange = getAuditLogsByDateRange;
exports.getAuditLogsForOutlet = getAuditLogsForOutlet;
exports.getAuditLogsForReview = getAuditLogsForReview;
exports.deleteOldAuditLogs = deleteOldAuditLogs;
exports.count = count;
exports.find = find;
exports.findById = findById;
exports.deleteById = deleteById;
const database_1 = require("../database");
/**
 * Create audit log entry
 */
async function createAuditLog(data) {
    return database_1.prisma.auditLog.create({
        data: {
            action: data.action,
            entity: data.entity,
            entityId: data.entityId,
            userId: data.userId,
            outletId: data.outletId ?? null,
            reviewId: data.reviewId ?? null,
            details: data.details === undefined
                ? null
                : typeof data.details === 'string'
                    ? data.details
                    : JSON.stringify(data.details),
            ip: data.ip ?? null,
            userAgent: data.userAgent ?? null,
        },
    });
}
/**
 * Get logs for a user
 */
async function getAuditLogsForUser(userId, limit = 100, offset = 0) {
    return database_1.prisma.auditLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });
}
/**
 * Get logs for a specific entity instance
 */
async function getAuditLogsForEntity(entity, entityId, limit = 50, offset = 0) {
    return database_1.prisma.auditLog.findMany({
        where: { entity, entityId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });
}
/**
 * Get logs for a specific action type
 */
async function getAuditLogsForAction(action, limit = 100, offset = 0) {
    return database_1.prisma.auditLog.findMany({
        where: { action },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
    });
}
/**
 * Get recent logs with user info
 */
async function getRecentAuditLogs(limit = 100) {
    return database_1.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            },
        },
    });
}
/**
 * Get only security-sensitive actions
 */
async function getSensitiveActions(limit = 100) {
    const sensitiveActions = [
        'USER_CREATED',
        'USER_DELETED',
        'ROLE_CHANGED',
        'API_KEY_GENERATED',
        'API_KEY_REVOKED',
        'TWO_FACTOR_ENABLED',
        'TWO_FACTOR_DISABLED',
        'IP_ALLOWLIST_ADDED',
        'IP_ALLOWLIST_REMOVED',
        'BILLING_PLAN_CHANGED',
        'ADMIN_LOGIN',
        'FAILED_LOGIN_ATTEMPT',
    ];
    return database_1.prisma.auditLog.findMany({
        where: {
            action: { in: sensitiveActions },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            },
        },
    });
}
/**
 * Get logs in date range
 */
async function getAuditLogsByDateRange(startDate, endDate, limit = 100) {
    return database_1.prisma.auditLog.findMany({
        where: {
            createdAt: {
                gte: startDate,
                lte: endDate,
            },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
/**
 * Get logs for outlet
 */
async function getAuditLogsForOutlet(outletId, limit = 100, offset = 0) {
    return database_1.prisma.auditLog.findMany({
        where: { outletId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
            user: {
                select: {
                    id: true,
                    email: true,
                    name: true,
                },
            },
        },
    });
}
/**
 * Get logs for review
 */
async function getAuditLogsForReview(reviewId, limit = 50) {
    return database_1.prisma.auditLog.findMany({
        where: { reviewId },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}
/**
 * Auto-purge old logs
 */
async function deleteOldAuditLogs(olderThanDays = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    return database_1.prisma.auditLog.deleteMany({
        where: {
            createdAt: { lt: cutoff },
        },
    });
}
// Export repository object with all methods
exports.auditRepository = {
    createAuditLog,
    getAuditLogsForUser,
    getAuditLogsForEntity,
    getAuditLogsForAction,
    getRecentAuditLogs,
    getSensitiveActions,
    getAuditLogsByDateRange,
    getAuditLogsForOutlet,
    getAuditLogsForReview,
    deleteOldAuditLogs,
};
// Compatibility helpers expected by routes
async function count(where) {
    return database_1.prisma.auditLog.count({ where });
}
async function find(where, limit = 50, offset = 0) {
    return database_1.prisma.auditLog.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' } });
}
async function findById(id) {
    return database_1.prisma.auditLog.findUnique({ where: { id } });
}
async function deleteById(id) {
    return database_1.prisma.auditLog.delete({ where: { id } });
}
// attach to exported object for convenience
Object.assign(exports.auditRepository, { count, find, findById, deleteById });
//# sourceMappingURL=audit.repo.js.map