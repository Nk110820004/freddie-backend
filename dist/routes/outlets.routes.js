"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const outlets_controller_1 = require("../controllers/outlets.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
// all outlet routes require login
router.use(auth_middleware_1.requireAuth);
// ------- ADMIN OR SUPER ADMIN -------
// get all outlets
router.get('/', rbac_middleware_1.requireAdmin, (req, res) => outlets_controller_1.outletsController.getAll(req, res));
// get outlet by id
router.get('/:id', rbac_middleware_1.requireAdmin, (req, res) => outlets_controller_1.outletsController.getById(req, res));
// outlet health metrics
router.get('/:id/health', rbac_middleware_1.requireAdmin, (req, res) => outlets_controller_1.outletsController.getHealth(req, res));
// outlet reviews list
router.get('/:id/reviews', rbac_middleware_1.requireAdmin, (req, res) => outlets_controller_1.outletsController.getReviews(req, res));
// ------- SUPER ADMIN ONLY -------
// create outlet
router.post('/', rbac_middleware_1.requireSuperAdmin, (req, res) => outlets_controller_1.outletsController.create(req, res));
// update outlet
router.put('/:id', rbac_middleware_1.requireSuperAdmin, (req, res) => outlets_controller_1.outletsController.update(req, res));
// delete outlet
router.delete('/:id', rbac_middleware_1.requireSuperAdmin, (req, res) => outlets_controller_1.outletsController.delete(req, res));
exports.default = router;
//# sourceMappingURL=outlets.routes.js.map