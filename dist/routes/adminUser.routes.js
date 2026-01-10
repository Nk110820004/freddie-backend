"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminUser_controller_1 = require("../controllers/adminUser.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
// require authenticated admin users
router.use(auth_middleware_1.requireAuth);
router.use(rbac_middleware_1.requireAdmin);
// Create new admin user (SUPER_ADMIN only)
router.post("/", rbac_middleware_1.requireSuperAdmin, (req, res) => adminUser_controller_1.adminUserController.create(req, res));
// Get all users
router.get("/", (req, res) => adminUser_controller_1.adminUserController.getUsers(req, res));
// Update user
router.put("/:id", rbac_middleware_1.requireSuperAdmin, (req, res) => adminUser_controller_1.adminUserController.updateUser(req, res));
// Delete user (SUPER_ADMIN only)
router.delete("/:id", rbac_middleware_1.requireSuperAdmin, (req, res) => adminUser_controller_1.adminUserController.deleteUser(req, res));
exports.default = router;
//# sourceMappingURL=adminUser.routes.js.map