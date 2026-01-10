"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityController = exports.SecurityController = void 0;
const ip_allowlist_repo_1 = require("../repository/ip-allowlist.repo");
const api_key_repo_1 = require("../repository/api-key.repo");
const outlets_repo_1 = require("../repository/outlets.repo");
const audit_repo_1 = require("../repository/audit.repo");
const apikey_service_1 = require("../services/apikey.service");
const logger_1 = require("../utils/logger");
const database_1 = require("../database");
const client_1 = require("@prisma/client");
const outletRepo = outlets_repo_1.outletsRepository;
class SecurityController {
    //
    // -------------------- RBAC ENFORCER --------------------
    //
    ensureAdmin(req) {
        const actor = req.user;
        if (!actor || (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN")) {
            const err = new Error("Admin access required");
            err.status = 403;
            throw err;
        }
        return actor;
    }
    //
    // -------------------- IP ALLOWLIST --------------------
    //
    async addIP(req, res) {
        try {
            const actor = this.ensureAdmin(req);
            const { ip, description } = req.body;
            if (!ip)
                return res.status(400).json({ error: "IP required" });
            // strict IPv4 + CIDR only
            const cidrRegex = /^(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)\.(25[0-5]|2[0-4]\d|[01]?\d\d?)(\/([0-9]|[12]\d|3[0-2]))?$/;
            if (!cidrRegex.test(ip)) {
                return res.status(400).json({ error: "Invalid IPv4/CIDR format" });
            }
            const exists = await ip_allowlist_repo_1.ipAllowlistRepository.getByIP(ip);
            if (exists)
                return res.status(409).json({ error: "IP already whitelisted" });
            const entry = await ip_allowlist_repo_1.ipAllowlistRepository.create(ip, description);
            await audit_repo_1.auditRepository.createAuditLog({
                action: "IP_ALLOWLIST_ADDED",
                entity: "IpAllowlist",
                entityId: entry.id,
                userId: actor.id
            });
            res.status(201).json({ message: "Added", entry });
        }
        catch (err) {
            logger_1.logger.error("addIP failed", err);
            res.status(err.status || 500).json({ error: err.message || "Failed" });
        }
    }
    //
    // -------------------- API KEY CREATION --------------------
    //
    async createAPIKey(req, res) {
        try {
            const actor = this.ensureAdmin(req);
            const { outletId } = req.body;
            const outlet = await database_1.prisma.outlet.findUnique({
                where: { id: outletId },
                include: { billing: true },
            });
            if (!outlet)
                return res.status(404).json({ error: "Outlet not found" });
            // ENFORCE ALL BUSINESS RULES
            if (outlet.onboardingStatus !== client_1.OnboardingStatus.COMPLETED) {
                return res.status(400).json({
                    error: "Onboarding must be completed before API key can be issued"
                });
            }
            if (outlet.billing?.status !== client_1.SubscriptionStatus.ACTIVE) {
                return res.status(400).json({
                    error: "Active subscription required before API key can be issued"
                });
            }
            if (outlet.apiStatus !== client_1.ApiStatus.ENABLED) {
                return res.status(400).json({
                    error: "API must be enabled before API key can be issued"
                });
            }
            const { key, keyHash, expiresAt } = apikey_service_1.apiKeyService.generateKey();
            const apiKey = await api_key_repo_1.apiKeyRepository.create({
                outletId,
                userId: actor.id,
                keyHash,
                expiresAt
            });
            await audit_repo_1.auditRepository.createAuditLog({
                action: "API_KEY_CREATED",
                entity: "ApiKey",
                entityId: apiKey.id,
                userId: actor.id,
                details: { outletId }
            });
            res.status(201).json({
                message: "API key generated",
                key,
                expiresAt,
                note: "This key will never be shown again"
            });
        }
        catch (err) {
            logger_1.logger.error("createAPIKey failed", err);
            res.status(err.status || 500).json({ error: err.message || "Failed" });
        }
    }
    async getIPAllowlist(req, res) {
        try {
            this.ensureAdmin(req);
            const list = await ip_allowlist_repo_1.ipAllowlistRepository.getAll();
            res.json(list);
        }
        catch (err) {
            logger_1.logger.error("getIPAllowlist failed", err);
            res.status(500).json({ error: "Failed to get IP allowlist" });
        }
    }
    async removeIP(req, res) {
        try {
            this.ensureAdmin(req);
            const { id } = req.params;
            await ip_allowlist_repo_1.ipAllowlistRepository.delete(id);
            res.json({ message: "IP removed" });
        }
        catch (err) {
            logger_1.logger.error("removeIP failed", err);
            res.status(500).json({ error: "Failed to remove IP" });
        }
    }
    async toggleIP(req, res) {
        try {
            this.ensureAdmin(req);
            const { id } = req.params;
            const entry = await ip_allowlist_repo_1.ipAllowlistRepository.getById(id);
            if (!entry)
                return res.status(404).json({ error: "IP not found" });
            const updated = await ip_allowlist_repo_1.ipAllowlistRepository.setStatus(id, !entry.isActive);
            res.json(updated);
        }
        catch (err) {
            logger_1.logger.error("toggleIP failed", err);
            res.status(500).json({ error: "Failed to toggle IP" });
        }
    }
    async getAPIKeys(req, res) {
        try {
            this.ensureAdmin(req);
            const keys = await api_key_repo_1.apiKeyRepository.getAll();
            res.json(keys);
        }
        catch (err) {
            logger_1.logger.error("getAPIKeys failed", err);
            res.status(500).json({ error: "Failed to get API keys" });
        }
    }
    async rotateAPIKey(req, res) {
        try {
            this.ensureAdmin(req);
            const { id } = req.params;
            // Generate new key
            const crypto = require('crypto');
            const newKey = crypto.randomBytes(32).toString('hex');
            const newKeyHash = crypto.createHash('sha256').update(newKey).digest('hex');
            const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
            const rotated = await api_key_repo_1.apiKeyRepository.rotate(id, newKeyHash, expiresAt);
            res.json({ message: "API key rotated", newKey, expiresAt });
        }
        catch (err) {
            logger_1.logger.error("rotateAPIKey failed", err);
            res.status(500).json({ error: "Failed to rotate API key" });
        }
    }
    async revokeAPIKey(req, res) {
        try {
            this.ensureAdmin(req);
            const { id } = req.params;
            await api_key_repo_1.apiKeyRepository.revoke(id);
            res.json({ message: "API key revoked" });
        }
        catch (err) {
            logger_1.logger.error("revokeAPIKey failed", err);
            res.status(500).json({ error: "Failed to revoke API key" });
        }
    }
    async getSettings(req, res) {
        try {
            this.ensureAdmin(req);
            // Placeholder for settings
            res.json({ message: "Settings endpoint" });
        }
        catch (err) {
            logger_1.logger.error("getSettings failed", err);
            res.status(500).json({ error: "Failed to get settings" });
        }
    }
}
exports.SecurityController = SecurityController;
exports.securityController = new SecurityController();
//# sourceMappingURL=security.controller.js.map