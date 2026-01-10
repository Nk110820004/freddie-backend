"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = exports.AuthController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const zod_1 = require("zod");
const users_repo_1 = require("../repository/users.repo");
const refreshTokens_repo_1 = require("../repository/refreshTokens.repo");
const audit_repo_1 = require("../repository/audit.repo");
const twofa_service_1 = require("../services/twofa.service");
const encryption_service_1 = require("../services/encryption.service");
const logger_1 = require("../utils/logger");
const token_util_1 = require("../utils/token.util");
const RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    outletName: zod_1.z.string().min(1)
});
class AuthController {
    constructor() {
        this.JWT_SECRET = process.env.JWT_ACCESS_SECRET ||
            "development-secret-change-this-in-production";
        this.JWT_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "24h";
        this.TEMP_TOKEN_EXPIRY = process.env.TEMP_TOKEN_EXPIRY || "10m";
        this.REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRY || "7d";
    }
    //
    // ---------------- REGISTER USER + OUTLET ----------------
    //
    async register(req, res) {
        try {
            const parsed = RegisterSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    message: "Invalid input",
                    errors: parsed.error.flatten()
                });
            }
            const { name, email, password, outletName } = parsed.data;
            const existing = await users_repo_1.usersRepository.getUserByEmail(email.toLowerCase());
            if (existing) {
                return res.status(409).json({ error: "User already exists" });
            }
            const passwordHash = await bcryptjs_1.default.hash(password, 12);
            const user = await users_repo_1.usersRepository.createUser({
                name,
                email: email.toLowerCase(),
                passwordHash,
                role: "USER"
            });
            // CRITICAL FIX: Outlet creation is ADMIN-ONLY
            // Users register without outlets. Admins must explicitly create and onboard outlets.
            // Do NOT auto-create outlets during registration.
            await audit_repo_1.auditRepository.createAuditLog({
                action: "USER_REGISTER",
                entity: "User",
                entityId: user.id,
                userId: user.id
            });
            const token = (0, token_util_1.signAccessToken)({
                userId: user.id,
                role: user.role,
                email: user.email
            });
            res.cookie("auth_token", token, this.authCookieOptions());
            res.status(201).json({
                token,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                message: "Registration successful – admin must create outlet"
            });
        }
        catch (err) {
            logger_1.logger.error("register failed", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    //
    // ---------------- ADMIN LOGIN ----------------
    //
    async loginAdmin(req, res) {
        try {
            const { email, password } = req.body;
            const user = await users_repo_1.usersRepository.getUserByEmail(email.toLowerCase());
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
                return res.status(403).json({ error: "Admin access required" });
            }
            const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!ok) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            // requires 2FA -> issue temp token
            if (user.twoFactorEnabled && user.twoFactorVerified) {
                const tempToken = jsonwebtoken_1.default.sign({
                    u: user.id,
                    requiresTwoFA: true
                }, this.JWT_SECRET, { expiresIn: this.TEMP_TOKEN_EXPIRY });
                return res.status(200).json({
                    requiresTwoFA: true,
                    tempToken
                });
            }
            await this.issueFullSession(user, req, res);
        }
        catch (err) {
            logger_1.logger.error("loginAdmin failed", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    //
    // ---------------- USER LOGIN ----------------
    //
    async loginUser(req, res) {
        try {
            const { email, password } = req.body;
            const user = await users_repo_1.usersRepository.getUserByEmail(email.toLowerCase());
            if (!user || user.role !== "USER") {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            const ok = await bcryptjs_1.default.compare(password, user.passwordHash);
            if (!ok) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            await this.issueFullSession(user, req, res);
        }
        catch (err) {
            logger_1.logger.error("loginUser failed", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    //
    // ---------------- 2FA VERIFY ----------------
    //
    async verifyTwoFA(req, res) {
        try {
            const { token, tempToken } = req.body;
            const payload = jsonwebtoken_1.default.verify(tempToken, this.JWT_SECRET);
            const user = await users_repo_1.usersRepository.getUserById(payload.u);
            if (!user || !user.twoFactorSecret) {
                return res.status(400).json({
                    error: "2FA not configured"
                });
            }
            const secret = encryption_service_1.encryptionService.decryptFromJson(user.twoFactorSecret);
            const ok = twofa_service_1.twoFAService.verifyToken(secret, token);
            if (!ok.valid) {
                return res.status(401).json({
                    error: "Invalid 2FA code"
                });
            }
            await this.issueFullSession(user, req, res);
        }
        catch (err) {
            logger_1.logger.error("verifyTwoFA failed", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    //
    // ---------------- LOGOUT ----------------
    //
    async logout(req, res) {
        try {
            const userId = req.userId;
            await refreshTokens_repo_1.refreshTokensRepository.deleteByUserId(userId);
            res.clearCookie("auth_token");
            res.clearCookie("refresh_token");
            res.json({ message: "Logged out" });
        }
        catch (err) {
            logger_1.logger.error("logout failed", err);
            res.status(500).json({ error: "Internal server error" });
        }
    }
    //
    // ---------------- INTERNAL HELPERS ----------------
    //
    async issueFullSession(user, req, res) {
        const accessToken = (0, token_util_1.signAccessToken)({
            userId: user.id,
            role: user.role,
            email: user.email
        });
        const refreshPlain = (0, token_util_1.generateRandomToken)(32);
        const refreshHash = (0, token_util_1.hashToken)(refreshPlain);
        const expiresAt = new Date(Date.now() + this.parseExpiryToMs(this.REFRESH_EXPIRES));
        await refreshTokens_repo_1.refreshTokensRepository.create(refreshHash, user.id, expiresAt);
        await audit_repo_1.auditRepository.createAuditLog({
            action: "USER_LOGIN",
            entity: "User",
            entityId: user.id,
            userId: user.id,
            ip: req.ip
        });
        res.cookie("auth_token", accessToken, this.authCookieOptions());
        res.cookie("refresh_token", refreshPlain, this.refreshCookieOptions());
        res.json({
            token: accessToken,
            refreshToken: "ok",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    }
    authCookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.COOKIE_SAME_SITE || 'lax',
            maxAge: this.parseExpiryToMs(this.JWT_EXPIRY)
        };
    }
    refreshCookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.COOKIE_SAME_SITE || 'lax',
            maxAge: this.parseExpiryToMs(this.REFRESH_EXPIRES)
        };
    }
    parseExpiryToMs(v) {
        if (v.endsWith("d"))
            return parseInt(v) * 86400000;
        if (v.endsWith("h"))
            return parseInt(v) * 3600000;
        return parseInt(v) * 1000;
    }
    async getCurrentUser(req, res) {
        try {
            const user = await users_repo_1.usersRepository.getById(req.userId);
            if (!user)
                return res.status(404).json({ error: "User not found" });
            res.json(user);
        }
        catch (err) {
            logger_1.logger.error("getCurrentUser failed", err);
            res.status(500).json({ error: "Failed to get user" });
        }
    }
    static validatePasswordStrength(password) {
        // Simple validation
        if (password.length < 8)
            return false;
        return true;
    }
}
exports.AuthController = AuthController;
exports.authController = new AuthController();
//# sourceMappingURL=auth.controller.js.map