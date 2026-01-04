import { Router } from "express"
import { paymentController } from "../controllers/payment.controller"
import { requireAuth } from "../middleware/auth.middleware"
import { requireAdmin } from "../middleware/rbac.middleware"

const router = Router()

// All routes require authentication
router.use(requireAuth)

router.use(requireAdmin)

// Create Razorpay order
router.post("/create-order", (req, res) => paymentController.createOrder(req, res))

// Verify payment
router.post("/verify-payment", (req, res) => paymentController.verifyPayment(req, res))

export default router
