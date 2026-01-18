import { Router } from "express"
import { adminController } from "../controllers/admin.controller"
import { requireAdmin, requireAuth } from "../middleware/auth.middleware"
import { validateOnboarding, validateSubscriptionUpdate } from "../middleware/compliance.middleware"
import { integrationsController } from "../controllers/integrations.controller"

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

// Update user Google email
router.put("/users/:userId/google-email", (req, res) => adminController.updateUserGoogleEmail(req, res))

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

// Google Business Profile integration
router.post("/outlets/:outletId/google/connect-link", (req, res) => adminController.generateGoogleConnectLink(req, res))
router.get("/outlets/:outletId/google/locations", (req, res) => integrationsController.getGMBLocationsForOutlet(req, res))
router.post("/outlets/:outletId/google/link-location", (req, res) => adminController.linkGoogleLocation(req, res))

// Onboarding Wizard Routes
router.post("/onboarding/send-connect-link", (req, res) => adminController.sendGoogleConnectLink(req, res))
router.get("/onboarding/user/:userId/locations", (req, res) => adminController.getLocationsForUser(req, res))
router.post("/onboarding/enable-outlets", (req, res) => adminController.enableOutletsBulk(req, res))

export default router
