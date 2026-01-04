import { Router } from 'express';
import { reviewsController } from '../controllers/reviews.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/rbac.middleware';

const router = Router();

// all routes require auth
router.use(requireAuth);

// -------- ADMIN + SUPER ADMIN --------

// get all reviews
router.get('/', requireAdmin, (req, res) =>
  reviewsController.getAll(req, res)
);

// get review by id
router.get('/:id', requireAdmin, (req, res) =>
  reviewsController.getById(req, res)
);

// get reviews for outlet
router.get('/outlet/:outletId', requireAdmin, (req, res) =>
  reviewsController.getByOutlet(req, res)
);

// update review status
router.patch('/:id/status', requireAdmin, (req, res) =>
  reviewsController.updateStatus(req, res)
);

// add manual reply
router.post('/:id/manual-reply', requireAdmin, (req, res) =>
  reviewsController.addManualReply(req, res)
);

// -------- SUPER ADMIN ONLY --------

// delete review
router.delete('/:id', requireSuperAdmin, (req, res) =>
  reviewsController.delete(req, res)
);

export default router;
