"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const security_controller_1 = require("../controllers/security.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
// all security routes require auth
router.use(auth_middleware_1.requireAuth);
// -------- SUPER ADMIN ONLY --------
// IP allowlist list
router.get('/ips', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.getIPAllowlist(req, res));
// add IP
router.post('/ips', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.addIP(req, res));
// delete IP
router.delete('/ips/:id', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.removeIP(req, res));
// toggle IP active
router.patch('/ips/:id/toggle', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.toggleIP(req, res));
// API keys list
router.get('/apikeys', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.getAPIKeys(req, res));
// create API key
router.post('/apikeys', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.createAPIKey(req, res));
// rotate API key
router.post('/apikeys/:id/rotate', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.rotateAPIKey(req, res));
// revoke API key
router.post('/apikeys/:id/revoke', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.revokeAPIKey(req, res));
// security dashboard summary
router.get('/settings', rbac_middleware_1.requireSuperAdmin, (req, res) => security_controller_1.securityController.getSettings(req, res));
exports.default = router;
//# sourceMappingURL=security.routes.js.map