"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditController = exports.AuditController = void 0;
const audit_repo_1 = require("../repository/audit.repo");
const logger_1 = require("../utils/logger");
class AuditController {
    async list(req, res) {
        try {
            const { limit = "50" } = req.query;
            const logs = await audit_repo_1.auditRepository.getRecentAuditLogs(parseInt(limit, 10));
            res.status(200).json(logs);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch audit logs", error);
            res.status(500).json({ error: "Failed to fetch audit logs" });
        }
    }
    async byUser(req, res) {
        try {
            const { userId } = req.params;
            const logs = await audit_repo_1.auditRepository.getAuditLogsForUser(userId);
            res.status(200).json(logs);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch user audit logs", error);
            res.status(500).json({ error: "Failed to fetch user logs" });
        }
    }
    async sensitive(req, res) {
        try {
            const logs = await audit_repo_1.auditRepository.getSensitiveActions();
            res.status(200).json(logs);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch sensitive logs", error);
            res.status(500).json({ error: "Failed to fetch sensitive logs" });
        }
    }
    async delete(req, res) {
        try {
            const { id } = req.params;
            await audit_repo_1.auditRepository.deleteOldAuditLogs();
            res.status(200).json({ message: "Audit log deleted" });
        }
        catch (error) {
            logger_1.logger.error("Failed to delete audit log", error);
            res.status(500).json({ error: "Failed to delete log" });
        }
    }
}
exports.AuditController = AuditController;
exports.auditController = new AuditController();
//# sourceMappingURL=audit.controller.js.map