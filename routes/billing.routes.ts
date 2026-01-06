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

// update billing status
router.patch('/outlet/:outletId/status', requireSuperAdmin, (req, res) =>
  billingController.updateStatus(req, res)
);

export default router;
