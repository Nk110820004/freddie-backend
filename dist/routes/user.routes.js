"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.requireAuth);
/**
 * GET /api/user/me
 * Get current user profile
 */
router.get("/me", (req, res) => user_controller_1.userController.getProfile(req, res));
/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put("/profile", (req, res) => user_controller_1.userController.updateProfile(req, res));
/**
 * GET /api/user/outlets
 * Get all outlets for current user
 */
router.get("/outlets", (req, res) => user_controller_1.userController.getOutlets(req, res));
/**
 * GET /api/user/reviews
 * Get all reviews for user's outlets
 */
router.get("/reviews", (req, res) => user_controller_1.userController.getReviews(req, res));
/**
 * GET /api/user/stats
 * Get dashboard stats
 */
router.get("/stats", (req, res) => user_controller_1.userController.getStats(req, res));
/**
 * GET /api/user/google-oauth-url
 * Get Google OAuth URL for connecting account
 */
router.get("/google-oauth-url", (req, res) => user_controller_1.userController.getGoogleOAuthUrl(req, res));
/**
 * GET /api/user/google-callback
 * Handle Google OAuth callback
 */
router.get("/google-callback", user_controller_1.userController.handleGoogleCallback.bind(user_controller_1.userController));
/**
 * POST /api/user/connect-google
 * Connect Google account (exchange code and verify)
 */
router.post("/connect-google", (req, res) => user_controller_1.userController.connectGoogle(req, res));
/**
 * POST /api/user/connect-whatsapp
 * Connect WhatsApp number and send verification/test message
 */
router.post("/connect-whatsapp", (req, res) => user_controller_1.userController.connectWhatsApp(req, res));
exports.default = router;
//# sourceMappingURL=user.routes.js.map