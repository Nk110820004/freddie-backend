import { Router } from "express"
import { userController } from "../controllers/user.controller"
import { requireAuth } from "../middleware/auth.middleware"

const router = Router()

// All routes require authentication
router.use(requireAuth)

/**
 * GET /api/user/me
 * Get current user profile
 */
router.get("/me", (req, res) => userController.getProfile(req, res))

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put("/profile", (req, res) => userController.updateProfile(req, res))

/**
 * GET /api/user/outlets
 * Get all outlets for current user
 */
router.get("/outlets", (req, res) => userController.getOutlets(req, res))

/**
 * GET /api/user/reviews
 * Get all reviews for user's outlets
 */
router.get("/reviews", (req, res) => userController.getReviews(req, res))

/**
 * GET /api/user/stats
 * Get dashboard stats
 */
router.get("/stats", (req, res) => userController.getStats(req, res))

/**
 * GET /api/user/google-oauth-url
 * Get Google OAuth URL for connecting account
 */
router.get("/google-oauth-url", (req, res) => userController.getGoogleOAuthUrl(req, res))

/**
 * POST /api/user/connect-google
 * Connect Google account (exchange code and verify)
 */
router.post("/connect-google", (req, res) => userController.connectGoogle(req, res))

/**
 * POST /api/user/connect-whatsapp
 * Connect WhatsApp number and send verification/test message
 */
router.post("/connect-whatsapp", (req, res) => userController.connectWhatsApp(req, res))

export default router
