"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reviews_controller_1 = require("../controllers/reviews.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
// all routes require auth
router.use(auth_middleware_1.requireAuth);
// -------- ADMIN + SUPER ADMIN --------
// get all reviews
router.get('/', rbac_middleware_1.requireAdmin, (req, res) => reviews_controller_1.reviewsController.getAll(req, res));
// get review by id
router.get('/:id', rbac_middleware_1.requireAdmin, (req, res) => reviews_controller_1.reviewsController.getById(req, res));
// get reviews for outlet
router.get('/outlet/:outletId', rbac_middleware_1.requireAdmin, (req, res) => reviews_controller_1.reviewsController.getByOutlet(req, res));
// update review status
router.patch('/:id/status', rbac_middleware_1.requireAdmin, (req, res) => reviews_controller_1.reviewsController.updateStatus(req, res));
// add manual reply
router.post('/:id/manual-reply', rbac_middleware_1.requireAdmin, (req, res) => reviews_controller_1.reviewsController.addManualReply(req, res));
// -------- SUPER ADMIN ONLY --------
// delete review
router.delete('/:id', rbac_middleware_1.requireSuperAdmin, (req, res) => reviews_controller_1.reviewsController.delete(req, res));
exports.default = router;
//# sourceMappingURL=reviews.routes.js.map