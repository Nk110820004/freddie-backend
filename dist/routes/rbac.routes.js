"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rbac_controller_1 = require("../controllers/rbac.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
router.get("/users", (req, res) => rbac_controller_1.rbacController.getAdminUsers(req, res));
router.post("/user/role", (req, res) => rbac_controller_1.rbacController.updateUserRole(req, res));
router.post("/invite", rbac_middleware_1.requireSuperAdmin, (req, res) => rbac_controller_1.rbacController.inviteUser(req, res));
router.post("/user/twofa", (req, res) => rbac_controller_1.rbacController.toggleTwoFA(req, res));
router.delete("/user/:id", (req, res) => rbac_controller_1.rbacController.deleteUser(req, res));
router.get("/roles", rbac_middleware_1.requireSuperAdmin, (req, res) => rbac_controller_1.rbacController.getRoles(req, res));
router.post("/users/:userId/role", rbac_middleware_1.requireSuperAdmin, (req, res) => rbac_controller_1.rbacController.assignRole(req, res));
exports.default = router;
//# sourceMappingURL=rbac.routes.js.map