"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingController = exports.BillingController = void 0;
const billing_repo_1 = require("../repository/billing.repo");
const logger_1 = require("../utils/logger");
const audit_repo_1 = require("../repository/audit.repo");
class BillingController {
    async getByOutlet(req, res) {
        try {
            const { outletId } = req.params;
            const billing = await billing_repo_1.billingRepository.getBillingByOutletId(outletId);
            if (!billing) {
                res.status(404).json({ error: "Billing not found" });
                return;
            }
            res.status(200).json(billing);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch billing", error);
            res.status(500).json({ error: "Failed to fetch billing" });
        }
    }
    async create(req, res) {
        try {
            const { outletId, status, trialEndsAt } = req.body;
            const actorId = req.userId || null;
            const billing = await billing_repo_1.billingRepository.createBilling({
                outletId,
                status,
                trialEndsAt,
            });
            res.status(201).json({
                message: "Billing created",
                billing,
            });
            if (billing) {
                await audit_repo_1.auditRepository.createAuditLog({
                    action: 'BILLING_CREATED',
                    entity: 'Billing',
                    entityId: billing.id,
                    userId: actorId,
                });
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to create billing", error);
            res.status(500).json({ error: "Failed to create billing" });
        }
    }
    async updateStatus(req, res) {
        try {
            const { outletId } = req.params;
            const { status } = req.body;
            const actorId = req.userId || null;
            const billing = await billing_repo_1.billingRepository.updateSubscriptionStatus(outletId, status);
            res.status(200).json({
                message: "Billing status updated",
                billing,
            });
            if (billing) {
                await audit_repo_1.auditRepository.createAuditLog({
                    action: 'BILLING_STATUS_UPDATED',
                    entity: 'Billing',
                    entityId: billing.id,
                    userId: actorId,
                    details: { status }
                });
            }
        }
        catch (error) {
            logger_1.logger.error("Failed to update billing status", error);
            res.status(500).json({ error: "Failed to update billing status" });
        }
    }
    async stats(req, res) {
        try {
            const stats = await billing_repo_1.billingRepository.getBillingStats();
            res.status(200).json(stats);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch billing stats", error);
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    }
    async getExpiringTrials(req, res) {
        try {
            const trials = await billing_repo_1.billingRepository.getExpiringTrials();
            res.status(200).json(trials);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch expiring trials", error);
            res.status(500).json({ error: "Failed to fetch expiring trials" });
        }
    }
    async getOverdue(req, res) {
        try {
            const overdue = await billing_repo_1.billingRepository.getOverdueBillings();
            res.status(200).json(overdue);
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch overdue", error);
            res.status(500).json({ error: "Failed to fetch overdue" });
        }
    }
}
exports.BillingController = BillingController;
exports.billingController = new BillingController();
//# sourceMappingURL=billing.controller.js.map