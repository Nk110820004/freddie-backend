"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const logger_1 = require("../utils/logger");
const audit_repo_1 = require("../repository/audit.repo");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
/**
 * GET /api/audit-logs
 * Super Admin only
 */
router.get('/', (0, rbac_middleware_1.rbacMiddleware)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { action, entity, userId, startDate, endDate, limit = '50', offset = '0', } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        const where = {};
        if (action)
            where.action = action;
        if (entity)
            where.entity = entity;
        if (userId)
            where.userId = userId;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.gte = new Date(startDate);
            if (endDate)
                where.createdAt.lte = new Date(endDate);
        }
        const [total, logs] = await Promise.all([
            audit_repo_1.auditRepository.count(where),
            audit_repo_1.auditRepository.find(where, parsedLimit, parsedOffset),
        ]);
        res.status(200).json({
            data: logs,
            pagination: {
                total,
                limit: parsedLimit,
                offset: parsedOffset,
                hasMore: parsedOffset + parsedLimit < total,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get audit logs', error);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});
/**
 * GET /api/audit-logs/user/:userId
 */
router.get('/user/:userId', (0, rbac_middleware_1.rbacMiddleware)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = '50', offset = '0' } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        const [total, logs] = await Promise.all([
            audit_repo_1.auditRepository.count({ userId }),
            audit_repo_1.auditRepository.find({ userId }, parsedLimit, parsedOffset),
        ]);
        res.status(200).json({
            data: logs,
            pagination: {
                total,
                limit: parsedLimit,
                offset: parsedOffset,
                hasMore: parsedOffset + parsedLimit < total,
            },
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get user audit logs', error);
        res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
});
/**
 * GET /api/audit-logs/:id
 */
router.get('/:id', (0, rbac_middleware_1.rbacMiddleware)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const log = await audit_repo_1.auditRepository.findById(id);
        if (!log) {
            res.status(404).json({ error: 'Audit log not found' });
            return;
        }
        res.status(200).json(log);
    }
    catch (error) {
        logger_1.logger.error('Failed to get audit log', error);
        res.status(500).json({ error: 'Failed to retrieve audit log' });
    }
});
/**
 * GET /api/audit-logs/security/events
 */
router.get('/security/events', (0, rbac_middleware_1.rbacMiddleware)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { limit = '100', offset = '0' } = req.query;
        const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
        const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);
        const logs = await audit_repo_1.auditRepository.getSensitiveActions(parsedLimit);
        res.status(200).json({
            data: logs,
            count: logs.length,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get security events', error);
        res.status(500).json({ error: 'Failed to retrieve security events' });
    }
});
/**
 * GET /api/audit-logs/failed-logins
 */
router.get('/failed-logins', (0, rbac_middleware_1.rbacMiddleware)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const hours = parseInt(req.query.hours || '24', 10);
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const logs = await audit_repo_1.auditRepository.getAuditLogsByDateRange(since, new Date(), 100);
        res.status(200).json({
            data: logs.filter((l) => l.action === 'LOGIN_FAILED_INVALID_CREDENTIALS'),
            timeframe: `Last ${hours} hours`,
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to get failed login attempts', error);
        res.status(500).json({ error: 'Failed to retrieve failed login attempts' });
    }
});
/**
 * DELETE /api/audit-logs/:id
 */
router.delete('/:id', (0, rbac_middleware_1.rbacMiddleware)(['SUPER_ADMIN']), async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await audit_repo_1.auditRepository.deleteById(id);
        if (!deleted) {
            res.status(404).json({ error: 'Audit log not found' });
            return;
        }
        res.status(200).json({ message: 'Audit log deleted' });
    }
    catch (error) {
        logger_1.logger.error('Failed to delete audit log', error);
        res.status(500).json({ error: 'Failed to delete audit log' });
    }
});
exports.default = router;
//# sourceMappingURL=audit.routes.js.map