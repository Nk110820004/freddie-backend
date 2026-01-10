"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = exports.AdminController = void 0;
const user_repo_1 = require("../repository/user.repo");
const logger_1 = require("../utils/logger");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const outlets_repo_1 = require("../repository/outlets.repo");
const manual_review_queue_repo_1 = require("../repository/manual-review-queue.repo");
const database_1 = require("../database"); // assuming prisma client is here
const billing_repo_1 = require("../repository/billing.repo");
const outletRepo = outlets_repo_1.outletsRepository;
const manualQueueRepo = new manual_review_queue_repo_1.ManualReviewQueueRepository(database_1.prisma);
class AdminController {
    async createUser(req, res) {
        try {
            const { name, email, role, phoneNumber, googleEmail, outletIds } = req.body;
            // Validate input
            if (!name || !email || !role) {
                res.status(400).json({ error: "Name, email, and role are required" });
                return;
            }
            // Check if user exists
            const existing = await user_repo_1.userRepository.findByEmail(email);
            if (existing) {
                res.status(409).json({ error: "User already exists" });
                return;
            }
            // Generate random password (user will reset on first login)
            const tempPassword = Math.random().toString(36).slice(-12);
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
            const user = await user_repo_1.userRepository.create({
                name,
                email,
                passwordHash,
                role,
                phoneNumber,
                googleEmail,
            });
            // Assign outlets if provided
            if (outletIds && outletIds.length > 0) {
                await user_repo_1.userRepository.assignOutlets(user.id, outletIds);
            }
            logger_1.logger.info(`User created: ${user.id}`, { email, role });
            res.status(201).json({
                message: "User created successfully",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to create user", error);
            res.status(500).json({ error: "Failed to create user" });
        }
    }
    async getUsers(req, res) {
        try {
            const { limit = "50", offset = "0" } = req.query;
            const users = await user_repo_1.userRepository.getAll(Number.parseInt(limit), Number.parseInt(offset));
            const total = await user_repo_1.userRepository.count();
            res.status(200).json({
                users,
                total,
                limit: Number.parseInt(limit),
                offset: Number.parseInt(offset),
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch users", error);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    }
    async updateUserRole(req, res) {
        try {
            const { userId } = req.params;
            const { role } = req.body;
            if (!role) {
                res.status(400).json({ error: "Role is required" });
                return;
            }
            const user = await user_repo_1.userRepository.updateRole(userId, role);
            logger_1.logger.info(`User role updated: ${userId}`, { role });
            res.status(200).json({
                message: "User role updated",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to update user role", error);
            res.status(500).json({ error: "Failed to update user role" });
        }
    }
    async deleteUser(req, res) {
        try {
            const { userId } = req.params;
            const user = await user_repo_1.userRepository.softDelete(userId);
            logger_1.logger.info(`User deleted: ${userId}`);
            res.status(200).json({ message: "User deleted successfully" });
        }
        catch (error) {
            logger_1.logger.error("Failed to delete user", error);
            res.status(500).json({ error: "Failed to delete user" });
        }
    }
    async assignOutlets(req, res) {
        try {
            const { userId } = req.params;
            const { outletIds } = req.body;
            if (!outletIds || !Array.isArray(outletIds)) {
                res.status(400).json({ error: "outletIds array is required" });
                return;
            }
            await user_repo_1.userRepository.assignOutlets(userId, outletIds);
            logger_1.logger.info(`Outlets assigned to user: ${userId}`, { outletIds });
            res.status(200).json({ message: "Outlets assigned successfully" });
        }
        catch (error) {
            logger_1.logger.error("Failed to assign outlets", error);
            res.status(500).json({ error: "Failed to assign outlets" });
        }
    }
    async onboardUser(req, res) {
        try {
            const { name, email, whatsappNumber, gmbOutletId, outletName, subscriptionPlan = "MONTHLY", subscriptionStatus = "TRIAL", category = "OTHER", } = req.body;
            // Validate required fields per prompt
            if (!name || !email || !whatsappNumber || !outletName) {
                res.status(400).json({ error: "Name, email, WhatsApp, and outlet name are required" });
                return;
            }
            // Check if user exists
            const existing = await user_repo_1.userRepository.findByEmail(email.toLowerCase());
            if (existing) {
                res.status(409).json({ error: "User already exists" });
                return;
            }
            // Generate credentials
            const tempPassword = crypto_1.default.randomBytes(8).toString("hex");
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 12);
            // 1. Create User
            const user = await user_repo_1.userRepository.create({
                name,
                email: email.toLowerCase(),
                passwordHash,
                role: "USER",
                phoneNumber: whatsappNumber,
            });
            // 2. Create Outlet via new repository with rules
            const outlet = await outletRepo.createOutlet({
                name: outletName,
                userId: user.id,
                primaryContactName: name,
                contactEmail: email.toLowerCase(),
                contactPhone: whatsappNumber,
                category: category,
                subscriptionPlan: subscriptionPlan,
                subscriptionStatus: subscriptionStatus,
                googlePlaceId: gmbOutletId,
            });
            // 3. Log onboarding
            logger_1.logger.info(`User onboarded: ${user.id} with outlet ${outlet.id}`);
            res.status(201).json({
                message: "User onboarded successfully",
                credentials: {
                    email: user.email,
                    password: tempPassword,
                    loginUrl: "/user/login",
                },
                user,
                outlet,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to onboard user", error);
            res.status(500).json({ error: "Failed to onboard user" });
        }
    }
    async onboardOutlet(req, res) {
        try {
            const { name, email, whatsappNumber, gmbOutletId, outletName, groupName, subscriptionPlan = "MONTHLY", subscriptionStatus = "TRIAL", category = "OTHER", } = req.body;
            // Validate required fields per requirements
            if (!name || !email || !whatsappNumber || !outletName) {
                res.status(400).json({
                    error: "Incomplete onboarding data",
                    message: "Name, email, WhatsApp number, and outlet name are required",
                });
                return;
            }
            // Check if user exists
            const existing = await user_repo_1.userRepository.findByEmail(email.toLowerCase());
            if (existing) {
                res.status(409).json({ error: "User with this email already exists" });
                return;
            }
            // Generate secure temporary credentials
            const tempPassword = crypto_1.default.randomBytes(12).toString("hex");
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 12);
            // Create user
            const user = await user_repo_1.userRepository.create({
                name,
                email: email.toLowerCase(),
                passwordHash,
                role: "USER",
                phoneNumber: whatsappNumber,
            });
            // Create outlet with business rule enforcement
            const outlet = await outletRepo.createOutlet({
                name: outletName,
                groupName,
                userId: user.id,
                primaryContactName: name,
                contactEmail: email.toLowerCase(),
                contactPhone: whatsappNumber,
                category: category,
                subscriptionPlan: subscriptionPlan,
                subscriptionStatus: subscriptionStatus,
                googlePlaceId: gmbOutletId,
                googleLocationName: gmbOutletId,
            });
            // Complete onboarding if all fields are present
            if (subscriptionStatus !== "UNPAID") {
                await outletRepo.completeOnboarding(outlet.id);
            }
            logger_1.logger.info(`Outlet onboarded: ${outlet.id} for user ${user.id}`);
            res.status(201).json({
                message: "Outlet onboarded successfully",
                credentials: {
                    email: user.email,
                    password: tempPassword,
                    loginUrl: "/user/login",
                },
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                },
                outlet: {
                    id: outlet.id,
                    name: outlet.name,
                    subscriptionStatus: outlet.subscriptionStatus,
                    apiStatus: outlet.apiStatus,
                    onboardingStatus: outlet.onboardingStatus,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to onboard outlet", error);
            res.status(500).json({ error: "Failed to onboard outlet" });
        }
    }
    async updateSubscription(req, res) {
        try {
            const { outletId } = req.params;
            const { subscriptionStatus, billingStatus, apiStatus, remarks } = req.body;
            if (!req.userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            if (!remarks) {
                res.status(400).json({
                    error: "Remarks are required",
                    message: "Admin remarks must be provided for subscription updates",
                });
                return;
            }
            // Validate outlet exists
            const outlet = await outletRepo.getOutletById(outletId);
            if (!outlet) {
                res.status(404).json({ error: "Outlet not found" });
                return;
            }
            // Update with business rule enforcement and audit trail
            const updated = await outletRepo.update(outletId, {
                subscriptionStatus,
                apiStatus,
            });
            if (billingStatus) {
                await billing_repo_1.billingRepository.updateSubscriptionStatus(outletId, billingStatus);
            }
            logger_1.logger.info(`Subscription updated for outlet ${outletId} by admin ${req.userId}`);
            res.status(200).json({
                message: "Subscription updated successfully",
                outlet: {
                    id: updated.id,
                    name: updated.name,
                    subscriptionStatus: updated.subscriptionStatus,
                    apiStatus: updated.apiStatus,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to update subscription", error);
            res.status(400).json({
                error: error instanceof Error ? error.message : "Subscription update failed",
            });
        }
    }
    async getAllOutlets(req, res) {
        try {
            const outlets = await outletRepo.getAllOutlets();
            res.status(200).json({
                outlets,
                total: outlets.length,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch outlets", error);
            res.status(500).json({ error: "Failed to fetch outlets" });
        }
    }
    async getManualReviewQueue(req, res) {
        try {
            const { status } = req.query;
            const whereClause = {};
            if (status) {
                whereClause.status = status;
            }
            const queue = await database_1.prisma.manualReviewQueue.findMany({
                where: whereClause,
                include: {
                    review: {
                        include: {
                            outlet: {
                                select: {
                                    id: true,
                                    name: true,
                                },
                            },
                        },
                    },
                    assignedAdmin: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: "asc",
                },
            });
            res.status(200).json({
                queue,
                total: queue.length,
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to fetch manual review queue", error);
            res.status(500).json({ error: "Failed to fetch manual review queue" });
        }
    }
    async submitManualReply(req, res) {
        try {
            const { reviewId } = req.params;
            const { replyText } = req.body;
            if (!replyText || typeof replyText !== "string" || replyText.trim().length === 0) {
                res.status(400).json({ error: "Reply text is required" });
                return;
            }
            // Get review and queue item
            const review = await database_1.prisma.review.findUnique({
                where: { id: reviewId },
                include: {
                    outlet: {
                        include: {
                            user: true,
                        },
                    },
                    manualQueue: true,
                },
            });
            if (!review) {
                res.status(404).json({ error: "Review not found" });
                return;
            }
            // Update review with manual reply
            await database_1.prisma.review.update({
                where: { id: reviewId },
                data: {
                    manualReplyText: replyText,
                    status: "CLOSED",
                },
            });
            // Mark queue item as responded
            if (review.manualQueue) {
                await manualQueueRepo.markAsResponded(review.manualQueue.id);
            }
            // Post to GMB if credentials available
            if (review.outlet.user.googleRefreshToken && review.outlet.googleLocationName && review.googleReviewId) {
                const { gmbService } = await import("../integrations/gmb.js");
                await gmbService.postReply(review.outlet.googleLocationName, review.googleReviewId, replyText, review.outlet.user.googleRefreshToken);
            }
            logger_1.logger.info(`Manual reply submitted for review ${reviewId} by admin ${req.userId}`);
            res.status(200).json({
                message: "Manual reply submitted successfully",
                review: {
                    id: review.id,
                    status: "CLOSED",
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to submit manual reply", error);
            res.status(500).json({ error: "Failed to submit manual reply" });
        }
    }
}
exports.AdminController = AdminController;
exports.adminController = new AdminController();
//# sourceMappingURL=admin.controller.js.map