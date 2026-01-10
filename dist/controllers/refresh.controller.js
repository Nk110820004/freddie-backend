"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refreshController = exports.RefreshController = void 0;
const token_util_1 = require("../utils/token.util");
const refreshTokens_repo_1 = require("../repository/refreshTokens.repo");
const users_repo_1 = require("../repository/users.repo");
const token_util_2 = require("../utils/token.util");
const logger_1 = require("../utils/logger");
class RefreshController {
    async rotate(req, res) {
        try {
            const refreshCookie = req.cookies?.refresh_token || req.headers['x-refresh-token'] || req.body.refreshToken;
            if (!refreshCookie) {
                res.status(401).json({ error: 'Missing refresh token' });
                return;
            }
            const hashed = (0, token_util_1.hashToken)(String(refreshCookie));
            const db = await refreshTokens_repo_1.refreshTokensRepository.findByHash(hashed);
            if (!db) {
                res.status(401).json({ error: 'Invalid or revoked refresh token' });
                return;
            }
            if (db.expiresAt < new Date()) {
                // remove expired
                await refreshTokens_repo_1.refreshTokensRepository.deleteByHash(hashed);
                res.status(401).json({ error: 'Refresh token expired' });
                return;
            }
            const user = await users_repo_1.usersRepository.getUserById(db.userId);
            if (!user || user.deletedAt) {
                res.status(401).json({ error: 'User not found or disabled' });
                return;
            }
            // rotate refresh token: delete existing and issue new one
            await refreshTokens_repo_1.refreshTokensRepository.deleteByHash(hashed);
            const newPlain = (0, token_util_1.generateRandomToken)(32);
            const newHash = (0, token_util_1.hashToken)(newPlain);
            const expiresAtNew = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
            await refreshTokens_repo_1.refreshTokensRepository.create(newHash, user.id, expiresAtNew);
            const accessToken = (0, token_util_2.signAccessToken)({ userId: user.id, role: user.role, email: user.email });
            res.cookie('auth_token', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.COOKIE_SAME_SITE || 'lax',
                maxAge: 1000 * 60 * 60,
            });
            res.cookie('refresh_token', newPlain, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.COOKIE_SAME_SITE || 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
            res.status(200).json({ token: accessToken });
        }
        catch (err) {
            logger_1.logger.error('Refresh rotate error', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
exports.RefreshController = RefreshController;
exports.refreshController = new RefreshController();
//# sourceMappingURL=refresh.controller.js.map