import { Router } from 'express';
import { outletsController } from '../controllers/outlets.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireAdmin, requireSuperAdmin } from '../middleware/rbac.middleware';

const router = Router();

// all outlet routes require login
router.use(requireAuth);

// ------- ADMIN OR SUPER ADMIN -------

// get all outlets
router.get('/', requireAdmin, (req, res) => outletsController.getAll(req, res));

// get outlet by id
router.get('/:id', requireAdmin, (req, res) => outletsController.getById(req, res));

// outlet health metrics
router.get('/:id/health', requireAdmin, (req, res) =>
  outletsController.getHealth(req, res)
);

// outlet reviews list
router.get('/:id/reviews', requireAdmin, (req, res) =>
  outletsController.getReviews(req, res)
);

// ------- SUPER ADMIN ONLY -------

// create outlet
router.post('/', requireSuperAdmin, (req, res) =>
  outletsController.create(req, res)
);

// update outlet
router.put('/:id', requireSuperAdmin, (req, res) =>
  outletsController.update(req, res)
);

// delete outlet
router.delete('/:id', requireSuperAdmin, (req, res) =>
  outletsController.delete(req, res)
);

export default router;
