"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacMiddleware = rbacMiddleware;
exports.requireSuperAdmin = requireSuperAdmin;
exports.requireAdmin = requireAdmin;
const logger_1 = require("../utils/logger");
/**
 * RBAC Middleware Factory
 * Returns a middleware function that checks if user has required roles
 */
function rbacMiddleware(allowedRoles) {
    return (req, res, next) => {
        // Check if user is authenticated
        if (!req.userId || !req.userRole) {
            res.status(401).json({
                error: 'Unauthorized',
            });
            return;
        }
        // Check if user has required role
        if (!allowedRoles.includes(req.userRole)) {
            logger_1.logger.warn(`User ${req.userId} attempted to access resource without proper role`, {
                userRole: req.userRole,
                requiredRoles: allowedRoles,
                path: req.path,
            });
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
function requireSuperAdmin(req, res, next) {
    if (!req.userId || !req.userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (req.userRole !== 'SUPER_ADMIN') {
        logger_1.logger.warn(`User ${req.userId} attempted to access super admin resource`, {
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
function requireAdmin(req, res, next) {
    if (!req.userId || !req.userRole) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!['SUPER_ADMIN', 'ADMIN'].includes(req.userRole)) {
        logger_1.logger.warn(`User ${req.userId} attempted to access admin resource`, {
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
//# sourceMappingURL=rbac.middleware.js.map