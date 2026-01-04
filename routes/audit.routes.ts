import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { rbacMiddleware } from '../middleware/rbac.middleware';
import { logger } from '../utils/logger';
import { auditRepository } from '../repository/audit.repo';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/audit-logs
 * Super Admin only
 */
router.get(
  '/',
  rbacMiddleware(['SUPER_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const {
        action,
        entity,
        userId,
        startDate,
        endDate,
        limit = '50',
        offset = '0',
      } = req.query;

      const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 500);
      const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      const where: any = {};

      if (action) where.action = action;
      if (entity) where.entity = entity;
      if (userId) where.userId = userId;

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const [total, logs] = await Promise.all([
        auditRepository.count(where),
        auditRepository.find(where, parsedLimit, parsedOffset),
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
    } catch (error) {
      logger.error('Failed to get audit logs', error);
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  }
);

/**
 * GET /api/audit-logs/user/:userId
 */
router.get(
  '/user/:userId',
  rbacMiddleware(['SUPER_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 500);
      const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      const [total, logs] = await Promise.all([
        auditRepository.count({ userId }),
        auditRepository.find({ userId }, parsedLimit, parsedOffset),
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
    } catch (error) {
      logger.error('Failed to get user audit logs', error);
      res.status(500).json({ error: 'Failed to retrieve audit logs' });
    }
  }
);

/**
 * GET /api/audit-logs/:id
 */
router.get(
  '/:id',
  rbacMiddleware(['SUPER_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const log = await auditRepository.findById(id);

      if (!log) {
        res.status(404).json({ error: 'Audit log not found' });
        return;
      }

      res.status(200).json(log);
    } catch (error) {
      logger.error('Failed to get audit log', error);
      res.status(500).json({ error: 'Failed to retrieve audit log' });
    }
  }
);

/**
 * GET /api/audit-logs/security/events
 */
router.get(
  '/security/events',
  rbacMiddleware(['SUPER_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { limit = '100', offset = '0' } = req.query;

      const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 500);
      const parsedOffset = Math.max(parseInt(offset as string, 10) || 0, 0);

      const logs = await auditRepository.getSensitiveActions(parsedLimit);

      res.status(200).json({
        data: logs,
        count: logs.length,
      });
    } catch (error) {
      logger.error('Failed to get security events', error);
      res.status(500).json({ error: 'Failed to retrieve security events' });
    }
  }
);

/**
 * GET /api/audit-logs/failed-logins
 */
router.get(
  '/failed-logins',
  rbacMiddleware(['SUPER_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const hours = parseInt((req.query.hours as string) || '24', 10);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const logs = await auditRepository.getAuditLogsByDateRange(since, new Date(), 100);

      res.status(200).json({
        data: logs.filter((l: any) => l.action === 'LOGIN_FAILED_INVALID_CREDENTIALS'),
        timeframe: `Last ${hours} hours`,
      });
    } catch (error) {
      logger.error('Failed to get failed login attempts', error);
      res.status(500).json({ error: 'Failed to retrieve failed login attempts' });
    }
  }
);

/**
 * DELETE /api/audit-logs/:id
 */
router.delete(
  '/:id',
  rbacMiddleware(['SUPER_ADMIN']),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const deleted = await auditRepository.deleteById(id);

      if (!deleted) {
        res.status(404).json({ error: 'Audit log not found' });
        return;
      }

      res.status(200).json({ message: 'Audit log deleted' });
    } catch (error) {
      logger.error('Failed to delete audit log', error);
      res.status(500).json({ error: 'Failed to delete audit log' });
    }
  }
);

export default router;
