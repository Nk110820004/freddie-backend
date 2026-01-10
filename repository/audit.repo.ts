import { prisma } from '../database';
import { AuditLog } from '@prisma/client';

/**
 * Create audit log entry
 */
export async function createAuditLog(data: {
  action: string;
  entity: string;
  entityId: string;
  userId: string;
  outletId?: string | null;
  reviewId?: string | null;
  details?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<AuditLog> {
  return prisma.auditLog.create({
    data: {
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      userId: data.userId,
      outletId: data.outletId ?? null,
      reviewId: data.reviewId ?? null,
      details:
        data.details === undefined
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
export async function getAuditLogsForUser(
  userId: string,
  limit = 100,
  offset = 0
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get logs for a specific entity instance
 */
export async function getAuditLogsForEntity(
  entity: string,
  entityId: string,
  limit = 50,
  offset = 0
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: { entity, entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get logs for a specific action type
 */
export async function getAuditLogsForAction(
  action: string,
  limit = 100,
  offset = 0
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: { action },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Get recent logs with user info
 */
export async function getRecentAuditLogs(limit = 100) {
  return prisma.auditLog.findMany({
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
export async function getSensitiveActions(limit = 100) {
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

  return prisma.auditLog.findMany({
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
export async function getAuditLogsByDateRange(
  startDate: Date,
  endDate: Date,
  limit = 100
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
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
export async function getAuditLogsForOutlet(
  outletId: string,
  limit = 100,
  offset = 0
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
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
export async function getAuditLogsForReview(
  reviewId: string,
  limit = 50
): Promise<AuditLog[]> {
  return prisma.auditLog.findMany({
    where: { reviewId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Auto-purge old logs
 */
export async function deleteOldAuditLogs(
  olderThanDays = 90
): Promise<{ count: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  return prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });
}

// Export repository object with all methods
export const auditRepository: any = {
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
export async function count(where: any): Promise<number> {
  return prisma.auditLog.count({ where })
}

export async function find(where: any, limit = 50, offset = 0) {
  return prisma.auditLog.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' } })
}

export async function findById(id: string) {
  return prisma.auditLog.findUnique({ where: { id } })
}

export async function deleteById(id: string) {
  return prisma.auditLog.delete({ where: { id } })
}

// attach to exported object for convenience
Object.assign(auditRepository, { count, find, findById, deleteById })
