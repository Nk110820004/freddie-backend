import { Router } from "express"
import { adminController } from "../controllers/admin.controller"
import { requireAdmin, requireAuth } from "../middleware/auth.middleware"
import { validateOnboarding, validateSubscriptionUpdate } from "../middleware/compliance.middleware"

const router = Router()

// All routes require authentication and admin role
router.use(requireAuth)
router.use(requireAdmin)

// Create new user
router.post("/users", (req, res) => adminController.createUser(req, res))

// Get all users
router.get("/users", (req, res) => adminController.getUsers(req, res))

// Update user role
router.put("/users/:userId/role", (req, res) => adminController.updateUserRole(req, res))

// Delete user (soft delete)
router.delete("/users/:userId", (req, res) => adminController.deleteUser(req, res))

// Assign outlets to user
router.post("/users/:userId/outlets", (req, res) => adminController.assignOutlets(req, res))

router.post("/outlets", validateOnboarding, (req, res) => adminController.onboardOutlet(req, res))

router.post("/outlets/:outletId/subscription", validateSubscriptionUpdate, (req, res) =>
  adminController.updateSubscription(req, res),
)

router.get("/outlets", (req, res) => adminController.getAllOutlets(req, res))

router.get("/reviews/manual-queue", (req, res) => adminController.getManualReviewQueue(req, res))

router.post("/reviews/:reviewId/manual-reply", (req, res) => adminController.submitManualReply(req, res))

export default router
