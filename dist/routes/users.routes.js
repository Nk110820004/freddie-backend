"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("../controllers/users.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
// all routes require authentication
router.use(auth_middleware_1.requireAuth);
// -------- SUPER ADMIN ONLY --------
// create admin user
router.post("/", rbac_middleware_1.requireSuperAdmin, (req, res) => users_controller_1.usersController.create(req, res));
// update user
router.put("/:id", rbac_middleware_1.requireSuperAdmin, (req, res) => users_controller_1.usersController.update(req, res));
// delete user
router.delete("/:id", rbac_middleware_1.requireSuperAdmin, (req, res) => users_controller_1.usersController.delete(req, res));
// -------- ADMIN & SUPER ADMIN --------
// get all users
router.get("/", rbac_middleware_1.requireAdmin, (req, res) => users_controller_1.usersController.getAll(req, res));
// get user by ID
router.get("/:id", rbac_middleware_1.requireAdmin, (req, res) => users_controller_1.usersController.getById(req, res));
// enroll 2FA
router.post("/:id/twofa/enroll", rbac_middleware_1.requireAdmin, (req, res) => users_controller_1.usersController.enrollTwoFA(req, res));
// verify 2FA enrollment
router.post("/:id/twofa/verify", rbac_middleware_1.requireAdmin, (req, res) => users_controller_1.usersController.verifyTwoFAEnrollment(req, res));
// change own password
router.post("/me/change-password", auth_middleware_1.requireAuth, (req, res) => users_controller_1.usersController.changePassword(req, res));
// get current user profile
router.get("/me/profile", auth_middleware_1.requireAuth, (req, res) => users_controller_1.usersController.getProfile(req, res));
// update current user profile
router.put("/me/profile", auth_middleware_1.requireAuth, (req, res) => users_controller_1.usersController.updateProfile(req, res));
exports.default = router;
//# sourceMappingURL=users.routes.js.map