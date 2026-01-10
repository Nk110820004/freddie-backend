"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const billing_controller_1 = require("../controllers/billing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const payment_controller_1 = require("../controllers/payment.controller");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
/**
 * Public webhook endpoint used by Razorpay. Must remain unauthenticated.
 */
router.post('/webhook', (req, res) => payment_controller_1.paymentController.webhook(req, res));
// requires authentication
router.use(auth_middleware_1.requireAuth);
// create order (alias for payments)
router.post('/create-order', (req, res) => payment_controller_1.paymentController.createOrder(req, res));
// verify payment (alias)
router.post('/verify-payment', (req, res) => payment_controller_1.paymentController.verifyPayment(req, res));
// -------- ADMIN + SUPER ADMIN --------
// get billing by outlet
router.get('/outlet/:outletId', rbac_middleware_1.requireAdmin, (req, res) => billing_controller_1.billingController.getByOutlet(req, res));
// get billing statistics dashboard
router.get('/stats/summary', rbac_middleware_1.requireAdmin, (req, res) => billing_controller_1.billingController.stats(req, res));
// list expiring trials
router.get('/trials/expiring', rbac_middleware_1.requireAdmin, (req, res) => billing_controller_1.billingController.getExpiringTrials(req, res));
// list overdue subscriptions
router.get('/overdue', rbac_middleware_1.requireAdmin, (req, res) => billing_controller_1.billingController.getOverdue(req, res));
// -------- SUPER ADMIN ONLY --------
// update billing status
router.patch('/outlet/:outletId/status', rbac_middleware_1.requireSuperAdmin, (req, res) => billing_controller_1.billingController.updateStatus(req, res));
exports.default = router;
//# sourceMappingURL=billing.routes.js.map