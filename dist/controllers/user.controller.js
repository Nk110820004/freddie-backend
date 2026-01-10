"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = exports.UserController = void 0;
const zod_1 = require("zod");
const users_repo_1 = require("../repository/users.repo");
const reviews_repo_1 = require("../repository/reviews.repo");
const outlets_repo_1 = require("../repository/outlets.repo");
const logger_1 = require("../utils/logger");
const whatsapp_1 = require("../integrations/whatsapp");
const googleapis_1 = require("googleapis");
const env_1 = __importDefault(require("../config/env"));
const UserProfileSchema = zod_1.z.object({
    whatsappNumber: zod_1.z.string().optional(),
    gmbAccountId: zod_1.z.string().optional(),
});
const WhatsAppConnectSchema = zod_1.z.object({
    phoneNumber: zod_1.z.string().min(1, { message: "phoneNumber is required" }),
});
class UserController {
    /**
     * GET /api/user/me
     * Get current user profile
     */
    async getProfile(req, res) {
        try {
            const userId = req.userId;
            const user = await users_repo_1.usersRepository.getUserById(userId);
            if (!user) {
                res.status(404).json({ error: "User not found" });
                return;
            }
            res.status(200).json({
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    whatsappNumber: user.whatsappNumber,
                    gmbAccountId: user.gmbAccountId,
                    googleEmail: user.googleEmail,
                    createdAt: user.createdAt,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Get user profile error", error);
            res.status(500).json({ error: "Failed to fetch profile" });
        }
    }
    /**
     * PUT /api/user/profile
     * Update user profile (whatsapp number, gmbAccountId)
     */
    async updateProfile(req, res) {
        try {
            const userId = req.userId;
            const validation = UserProfileSchema.safeParse(req.body);
            if (!validation.success) {
                res.status(400).json({
                    message: "Invalid input",
                    errors: validation.error.formErrors.fieldErrors,
                });
                return;
            }
            const { whatsappNumber, gmbAccountId } = validation.data;
            const user = await users_repo_1.usersRepository.updateUser(userId, {
                whatsappNumber: whatsappNumber || undefined,
                gmbAccountId: gmbAccountId || undefined,
            });
            res.status(200).json({
                message: "Profile updated successfully",
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    whatsappNumber: user.whatsappNumber,
                    gmbAccountId: user.gmbAccountId,
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Update user profile error", error);
            res.status(500).json({ error: "Failed to update profile" });
        }
    }
    /**
     * GET /api/user/outlets
     * Get all outlets owned by current user
     */
    async getOutlets(req, res) {
        try {
            const userId = req.userId;
            const outlets = await outlets_repo_1.outletsRepository.getOutletsByUserId(userId);
            res.status(200).json({
                outlets,
            });
        }
        catch (error) {
            logger_1.logger.error("Get user outlets error", error);
            res.status(500).json({ error: "Failed to fetch outlets" });
        }
    }
    /**
     * GET /api/user/reviews
     * Get all reviews for user's outlets with pagination
     */
    async getReviews(req, res) {
        try {
            const userId = req.userId;
            const { limit = "50", offset = "0", status } = req.query;
            // Get user's outlets
            const outlets = await outlets_repo_1.outletsRepository.getOutletsByUserId(userId);
            const outletIds = outlets.map((o) => o.id);
            if (outletIds.length === 0) {
                res.status(200).json({
                    reviews: [],
                    total: 0,
                });
                return;
            }
            // Get reviews for all outlets
            let reviews = [];
            for (const outletId of outletIds) {
                const outletReviews = await reviews_repo_1.reviewsRepository.getReviewsByOutlet(outletId, Number.parseInt(limit, 10), Number.parseInt(offset, 10));
                reviews = reviews.concat(outletReviews);
            }
            // Filter by status if provided
            if (status && status !== "ALL") {
                reviews = reviews.filter((r) => r.status === status);
            }
            res.status(200).json({
                reviews,
                total: reviews.length,
            });
        }
        catch (error) {
            logger_1.logger.error("Get user reviews error", error);
            res.status(500).json({ error: "Failed to fetch reviews" });
        }
    }
    /**
     * GET /api/user/stats
     * Get dashboard statistics for user
     */
    async getStats(req, res) {
        try {
            const userId = req.userId;
            // Get user's outlets
            const outlets = await outlets_repo_1.outletsRepository.getOutletsByUserId(userId);
            const outletIds = outlets.map((o) => o.id);
            if (outletIds.length === 0) {
                res.status(200).json({
                    totalReviews: 0,
                    averageRating: 0,
                    pendingReplies: 0,
                    repliedReviews: 0,
                    escalatedReviews: 0,
                    aiReplies: 0,
                });
                return;
            }
            let allReviews = [];
            for (const outletId of outletIds) {
                const reviews = await reviews_repo_1.reviewsRepository.getReviewsByOutlet(outletId, 1000, 0);
                allReviews = allReviews.concat(reviews);
            }
            const totalReviews = allReviews.length;
            const averageRating = allReviews.length > 0 ? (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1) : 0;
            const pendingReplies = allReviews.filter((r) => r.status === "PENDING").length;
            const repliedReviews = allReviews.filter((r) => r.status === "CLOSED").length;
            const escalatedReviews = allReviews.filter((r) => r.status === "ESCALATED").length;
            const aiReplies = allReviews.filter((r) => r.aiReply).length;
            res.status(200).json({
                totalReviews,
                averageRating,
                pendingReplies,
                repliedReviews,
                escalatedReviews,
                aiReplies,
            });
        }
        catch (error) {
            logger_1.logger.error("Get user stats error", error);
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    }
    async getGoogleOAuthUrl(req, res) {
        try {
            const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.default.GOOGLE_CLIENT_ID, env_1.default.GOOGLE_CLIENT_SECRET, env_1.default.GOOGLE_REDIRECT_URI);
            const scopes = ['https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/business.manage'];
            const url = oauth2Client.generateAuthUrl({
                access_type: 'offline',
                scope: scopes,
                include_granted_scopes: true,
            });
            res.status(200).json({ url });
        }
        catch (error) {
            logger_1.logger.error("getGoogleOAuthUrl error", error);
            res.status(500).json({ error: "Failed to generate OAuth URL" });
        }
    }
    async connectGoogle(req, res) {
        try {
            const userId = req.userId;
            const { code } = req.body;
            if (!code || typeof code !== "string") {
                res.status(400).json({ error: "Authorization code is required" });
                return;
            }
            const oauth2Client = new googleapis_1.google.auth.OAuth2(env_1.default.GOOGLE_CLIENT_ID, env_1.default.GOOGLE_CLIENT_SECRET, env_1.default.GOOGLE_REDIRECT_URI);
            const { tokens } = await oauth2Client.getToken(code);
            if (!tokens) {
                res.status(400).json({ error: "Failed to exchange authorization code" });
                return;
            }
            oauth2Client.setCredentials(tokens);
            const oauth2 = googleapis_1.google.oauth2({ auth: oauth2Client, version: "v2" });
            const userinfo = await oauth2.userinfo.get();
            const email = userinfo.data.email || null;
            const profileId = userinfo.data.id || null;
            const updated = await users_repo_1.usersRepository.updateUser(userId, {
                googleEmail: email || undefined,
                googleProfileId: profileId || undefined,
                googleRefreshToken: tokens.refresh_token || undefined,
            });
            res.status(200).json({ message: "Google connected", user: { id: updated.id, googleEmail: updated.googleEmail } });
        }
        catch (error) {
            logger_1.logger.error("connectGoogle error", error);
            res.status(500).json({ error: "Failed to connect Google account" });
        }
    }
    async connectWhatsApp(req, res) {
        try {
            const userId = req.userId;
            const validation = WhatsAppConnectSchema.safeParse(req.body);
            if (!validation.success) {
                res.status(400).json({
                    message: "Invalid input",
                    errors: validation.error.formErrors.fieldErrors,
                });
                return;
            }
            const { phoneNumber } = validation.data;
            const updated = await users_repo_1.usersRepository.updateUser(userId, {
                whatsappNumber: phoneNumber,
            });
            const sent = await whatsapp_1.whatsappService.sendText(phoneNumber, "Your WhatsApp number has been connected to the app");
            if (!sent) {
                res.status(500).json({ error: "Failed to send test WhatsApp message; check integration credentials" });
                return;
            }
            res.status(200).json({ message: "WhatsApp connected and verified", user: { id: updated.id, whatsappNumber: updated.whatsappNumber } });
        }
        catch (error) {
            logger_1.logger.error("connectWhatsApp error", error);
            res.status(500).json({ error: "Failed to connect WhatsApp number" });
        }
    }
}
exports.UserController = UserController;
exports.userController = new UserController();
//# sourceMappingURL=user.controller.js.map