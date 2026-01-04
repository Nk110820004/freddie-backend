import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'USER';

/**
 * RBAC Middleware Factory
 * Returns a middleware function that checks if user has required roles
 */
export function rbacMiddleware(allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Check if user is authenticated
    if (!req.userId || !req.userRole) {
      res.status(401).json({
        error: 'Unauthorized',
      });
      return;
    }

    // Check if user has required role
    if (!allowedRoles.includes(req.userRole)) {
      logger.warn(
        `User ${req.userId} attempted to access resource without proper role`,
        {
          userRole: req.userRole,
          requiredRoles: allowedRoles,
          path: req.path,
        }
      );

      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
      return;
    }

    next();
  };
}

/**
 * Require Super Admin role
 */
export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId || !req.userRole) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.userRole !== 'SUPER_ADMIN') {
    logger.warn(`User ${req.userId} attempted to access super admin resource`, {
      userRole: req.userRole,
      path: req.path,
    });

    res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin access required',
    });
    return;
  }

  next();
}

/**
 * Require Admin or Super Admin role
 */
export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.userId || !req.userRole) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.userRole)) {
    logger.warn(`User ${req.userId} attempted to access admin resource`, {
      userRole: req.userRole,
      path: req.path,
    });

    res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required',
    });
    return;
  }

  next();
}
