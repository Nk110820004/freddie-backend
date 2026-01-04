import { Router } from 'express';
import { billingController } from '../controllers/billing.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { paymentController } from '../controllers/payment.controller';
import { requireAdmin, requireSuperAdmin } from '../middleware/rbac.middleware';

const router = Router();

/**
 * Public webhook endpoint used by Razorpay. Must remain unauthenticated.
 */
router.post('/webhook', (req, res) => paymentController.webhook(req, res));

// requires authentication
router.use(requireAuth);

// create order (alias for payments)
router.post('/create-order', (req, res) => paymentController.createOrder(req, res));

// verify payment (alias)
router.post('/verify-payment', (req, res) => paymentController.verifyPayment(req, res));

// -------- ADMIN + SUPER ADMIN --------

// get billing by outlet
router.get('/outlet/:outletId', requireAdmin, (req, res) =>
  billingController.getByOutlet(req, res)
);

// get billing statistics dashboard
router.get('/stats/summary', requireAdmin, (req, res) =>
  billingController.stats(req, res)
);

// list expiring trials
router.get('/trials/expiring', requireAdmin, (req, res) =>
  billingController.getExpiringTrials(req, res)
);

// list overdue subscriptions
router.get('/overdue', requireAdmin, (req, res) =>
  billingController.getOverdue(req, res)
);

// -------- SUPER ADMIN ONLY --------

// update billing plan
router.patch('/outlet/:outletId/plan', requireSuperAdmin, (req, res) =>
  billingController.updatePlan(req, res)
);

// activate billing
router.post('/outlet/:outletId/activate', requireSuperAdmin, (req, res) =>
  billingController.activate(req, res)
);

// deactivate billing
router.post('/outlet/:outletId/deactivate', requireSuperAdmin, (req, res) =>
  billingController.deactivate(req, res)
);

export default router;
