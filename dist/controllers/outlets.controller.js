"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outletsController = exports.OutletsController = void 0;
const outlets_repo_1 = require("../repository/outlets.repo");
const billing_repo_1 = require("../repository/billing.repo");
const audit_repo_1 = require("../repository/audit.repo");
const manual_review_queue_repo_1 = require("../repository/manual-review-queue.repo");
const reviews_repo_1 = require("../repository/reviews.repo");
const database_1 = require("../database");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
const outletRepo = outlets_repo_1.outletsRepository;
const manualQueueRepo = new manual_review_queue_repo_1.ManualReviewQueueRepository(database_1.prisma);
class OutletsController {
    //
    // -------- ADMIN — CREATE OUTLET (ONBOARDING START) --------
    //
    async create(req, res) {
        try {
            const actor = req.user;
            if (actor.role !== client_1.UserRole.ADMIN && actor.role !== client_1.UserRole.SUPER_ADMIN) {
                return res.status(403).json({ error: "Admin access required" });
            }
            const { name, userId, primaryContactName, contactEmail, contactPhone, category, subscriptionPlan } = req.body;
            if (!name ||
                !userId ||
                !primaryContactName ||
                !contactEmail ||
                !contactPhone) {
                return res.status(400).json({
                    error: "name, userId, primaryContactName, contactEmail, contactPhone are required"
                });
            }
            // Business Rule: Ensure user exists
            const userExists = await database_1.prisma.user.findUnique({ where: { id: userId } });
            if (!userExists) {
                return res.status(400).json({ error: "Specified user does not exist" });
            }
            const outlet = await outletRepo.createOutlet({
                name,
                userId,
                primaryContactName,
                contactEmail,
                contactPhone,
                category: category ?? "OTHER",
                subscriptionPlan: subscriptionPlan ?? "MONTHLY"
            });
            await audit_repo_1.auditRepository.createAuditLog({
                action: "OUTLET_ONBOARDING_STARTED",
                entity: "Outlet",
                entityId: outlet.id,
                userId: actor.id
            });
            res.status(201).json({
                message: "Outlet created in onboarding state",
                outlet
            });
        }
        catch (err) {
            logger_1.logger.error("create outlet failed", err);
            res.status(500).json({ error: err.message || "Failed to create outlet" });
        }
    }
    //
    // -------- MARK ONBOARDING COMPLETE --------
    //
    async completeOnboarding(req, res) {
        try {
            const { id } = req.params;
            const actor = req.user;
            // Business Rule: Admin or Owner? (Currently admin-only for strict flow)
            if (actor.role !== client_1.UserRole.ADMIN && actor.role !== client_1.UserRole.SUPER_ADMIN) {
                return res.status(403).json({ error: "Admin access required" });
            }
            const outlet = await outletRepo.completeOnboarding(id);
            await audit_repo_1.auditRepository.createAuditLog({
                action: "OUTLET_ONBOARDING_COMPLETED",
                entity: "Outlet",
                entityId: id,
                userId: actor.id
            });
            res.json({
                message: "Onboarding completed",
                outlet
            });
        }
        catch (err) {
            logger_1.logger.error("completeOnboarding failed", err);
            res.status(400).json({ error: err.message });
        }
    }
    //
    // -------- MANUAL SUBSCRIPTION OVERRIDE (ADMIN PANEL) --------
    //
    async markSubscriptionStatus(req, res) {
        try {
            const { id } = req.params;
            const { status, remark } = req.body;
            const actor = req.user;
            if (actor.role !== client_1.UserRole.ADMIN && actor.role !== client_1.UserRole.SUPER_ADMIN) {
                return res.status(403).json({ error: "Admin access required" });
            }
            if (!Object.values(client_1.SubscriptionStatus).includes(status)) {
                return res.status(400).json({ error: "Invalid subscription status" });
            }
            const billing = await billing_repo_1.billingRepository.updateSubscriptionStatus(id, status);
            await audit_repo_1.auditRepository.createAuditLog({
                action: "SUBSCRIPTION_STATUS_MANUAL_CHANGE",
                entity: "Billing",
                entityId: billing.id,
                userId: actor.id,
                details: { status, remark }
            });
            res.json({ message: "Subscription updated", billing });
        }
        catch (err) {
            logger_1.logger.error("Subscription override failed", err);
            res.status(500).json({ error: "Failed to change subscription" });
        }
    }
    //
    // -------- ENABLE/DISABLE API (Automation gating) --------
    //
    async setApiStatus(req, res) {
        try {
            const { id } = req.params;
            const { enable } = req.body;
            const actor = req.user;
            const outlet = await outletRepo.getOutletById(id);
            if (!outlet) {
                return res.status(404).json({ error: "Outlet not found" });
            }
            // Check permissions
            if (actor.role !== client_1.UserRole.ADMIN && actor.role !== client_1.UserRole.SUPER_ADMIN && actor.id !== outlet.userId) {
                return res.status(403).json({ error: "Permission denied" });
            }
            const apiStatus = enable ? client_1.ApiStatus.ENABLED : client_1.ApiStatus.DISABLED;
            // Business rules are enforced inside the repository method
            const updated = await outletRepo.setApiStatus(id, apiStatus);
            await audit_repo_1.auditRepository.createAuditLog({
                action: "API_STATUS_CHANGED",
                entity: "Outlet",
                entityId: id,
                userId: actor.id,
                details: { apiStatus: updated.apiStatus }
            });
            res.json({ message: "Updated API status", outlet: updated });
        }
        catch (err) {
            logger_1.logger.error("API status change failed", err);
            res.status(400).json({ error: err.message });
        }
    }
    //
    // -------- SAFE DELETE OUTLET --------
    //
    async delete(req, res) {
        try {
            const { id } = req.params;
            const actor = req.user;
            if (actor.role !== client_1.UserRole.ADMIN && actor.role !== client_1.UserRole.SUPER_ADMIN) {
                return res.status(403).json({ error: "Admin access required" });
            }
            await manualQueueRepo.deleteByOutlet(id);
            await database_1.prisma.outlet.delete({ where: { id } });
            await audit_repo_1.auditRepository.createAuditLog({
                action: "OUTLET_DELETED",
                entity: "Outlet",
                entityId: id,
                userId: actor.id
            });
            res.json({ message: "Outlet deleted" });
        }
        catch (err) {
            logger_1.logger.error("delete outlet failed", err);
            res.status(500).json({ error: "Failed to delete outlet" });
        }
    }
    async getAll(req, res) {
        try {
            const outlets = await outlets_repo_1.outletsRepository.getAllOutlets();
            res.json(outlets);
        }
        catch (err) {
            logger_1.logger.error("getAll outlets failed", err);
            res.status(500).json({ error: "Failed to get outlets" });
        }
    }
    async getById(req, res) {
        try {
            const { id } = req.params;
            const outlet = await outlets_repo_1.outletsRepository.getOutletById(id);
            if (!outlet)
                return res.status(404).json({ error: "Outlet not found" });
            res.json(outlet);
        }
        catch (err) {
            logger_1.logger.error("getById outlet failed", err);
            res.status(500).json({ error: "Failed to get outlet" });
        }
    }
    async getHealth(req, res) {
        try {
            // Placeholder
            res.json({ status: "healthy" });
        }
        catch (err) {
            logger_1.logger.error("getHealth failed", err);
            res.status(500).json({ error: "Failed" });
        }
    }
    async getReviews(req, res) {
        try {
            const { id } = req.params;
            const reviews = await reviews_repo_1.reviewsRepository.getReviewsByOutlet(id);
            res.json(reviews);
        }
        catch (err) {
            logger_1.logger.error("getReviews failed", err);
            res.status(500).json({ error: "Failed to get reviews" });
        }
    }
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            // Assume outletRepository has update
            const updated = await outlets_repo_1.outletsRepository.update(id, data);
            res.json(updated);
        }
        catch (err) {
            logger_1.logger.error("update outlet failed", err);
            res.status(500).json({ error: "Failed to update outlet" });
        }
    }
}
exports.OutletsController = OutletsController;
exports.outletsController = new OutletsController();
//# sourceMappingURL=outlets.controller.js.map