import { Router } from 'express';
import { securityController } from '../controllers/security.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireSuperAdmin } from '../middleware/rbac.middleware';

const router = Router();

// all security routes require auth
router.use(requireAuth);

// -------- SUPER ADMIN ONLY --------

// IP allowlist list
router.get('/ips', requireSuperAdmin, (req, res) =>
  securityController.getIPAllowlist(req, res)
);

// add IP
router.post('/ips', requireSuperAdmin, (req, res) =>
  securityController.addIP(req, res)
);

// delete IP
router.delete('/ips/:id', requireSuperAdmin, (req, res) =>
  securityController.removeIP(req, res)
);

// toggle IP active
router.patch('/ips/:id/toggle', requireSuperAdmin, (req, res) =>
  securityController.toggleIP(req, res)
);

// API keys list
router.get('/apikeys', requireSuperAdmin, (req, res) =>
  securityController.getAPIKeys(req, res)
);

// create API key
router.post('/apikeys', requireSuperAdmin, (req, res) =>
  securityController.createAPIKey(req, res)
);

// rotate API key
router.post('/apikeys/:id/rotate', requireSuperAdmin, (req, res) =>
  securityController.rotateAPIKey(req, res)
);

// revoke API key
router.post('/apikeys/:id/revoke', requireSuperAdmin, (req, res) =>
  securityController.revokeAPIKey(req, res)
);

// security dashboard summary
router.get('/settings', requireSuperAdmin, (req, res) =>
  securityController.getSettings(req, res)
);

export default router;
