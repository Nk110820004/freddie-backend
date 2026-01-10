"use strict";
/// <reference types="node" />
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireAdmin = requireAdmin;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const refreshTokens_repo_1 = require("../repository/refreshTokens.repo");
const token_util_1 = require("../utils/token.util");
const logger_1 = require("../utils/logger");
if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error("JWT_ACCESS_SECRET must be set in environment variables");
}
const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
async function requireAuth(req, res, next) {
    try {
        let token;
        // Check httpOnly cookie
        const cookies = req.headers.cookie?.split("; ");
        if (cookies) {
            const authCookie = cookies.find((c) => c.startsWith("auth_token="));
            if (authCookie) {
                token = authCookie.substring("auth_token=".length);
            }
        }
        // Fall back to Authorization header
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith("Bearer ")) {
                token = authHeader.substring(7);
            }
        }
        if (!token) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Missing or invalid authentication token",
            });
            return;
        }
        let payload;
        try {
            payload = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                res.status(401).json({ error: "Unauthorized", message: "Token expired" });
                return;
            }
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                res.status(401).json({ error: "Unauthorized", message: "Invalid token" });
                return;
            }
            throw error;
        }
        if (!payload.userId || !payload.role || !payload.email) {
            res.status(401).json({
                error: "Unauthorized",
                message: "Invalid token payload",
            });
            return;
        }
        // attach to request
        req.userId = payload.userId;
        req.userRole = payload.role;
        req.userEmail = payload.email;
        // prevent access if user has been soft-deleted
        // Note: usersRepository.getUserById already checks deletedAt; we avoid circular import here
        // but we can optionally check refresh token revocation based on cookie
        const refreshCookie = req.headers.cookie?.split('; ').find(c => c.startsWith('refresh_token='));
        if (refreshCookie) {
            const refreshPlain = refreshCookie.substring('refresh_token='.length);
            const hashed = (0, token_util_1.hashToken)(refreshPlain);
            // if refresh token is missing in DB -> revoke access
            const db = await refreshTokens_repo_1.refreshTokensRepository.findByHash(hashed);
            if (!db) {
                res.status(401).json({ error: 'Unauthorized', message: 'Refresh token revoked' });
                return;
            }
        }
        next();
    }
    catch (error) {
        logger_1.logger.error("Authentication middleware error", error);
        res.status(500).json({
            error: "Internal server error",
        });
    }
}
function requireAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (req.userRole === "ADMIN" || req.userRole === "SUPER_ADMIN") {
            next();
        }
        else {
            res.status(403).json({
                error: "Forbidden",
                message: "Insufficient permissions",
            });
        }
    });
}
//# sourceMappingURL=auth.middleware.js.map