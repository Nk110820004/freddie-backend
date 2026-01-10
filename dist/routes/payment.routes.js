"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.requireAuth);
router.use(rbac_middleware_1.requireAdmin);
// Create Razorpay order
router.post("/create-order", (req, res) => payment_controller_1.paymentController.createOrder(req, res));
// Verify payment
router.post("/verify-payment", (req, res) => payment_controller_1.paymentController.verifyPayment(req, res));
exports.default = router;
//# sourceMappingURL=payment.routes.js.map