"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const compliance_middleware_1 = require("../middleware/compliance.middleware");
const integrations_controller_1 = require("../controllers/integrations.controller");
const router = (0, express_1.Router)();
// All routes require authentication and admin role
router.use(auth_middleware_1.requireAuth);
router.use(auth_middleware_1.requireAdmin);
// Create new user
router.post("/users", (req, res) => admin_controller_1.adminController.createUser(req, res));
// Get all users
router.get("/users", (req, res) => admin_controller_1.adminController.getUsers(req, res));
// Update user role
router.put("/users/:userId/role", (req, res) => admin_controller_1.adminController.updateUserRole(req, res));
// Update user Google email
router.put("/users/:userId/google-email", (req, res) => admin_controller_1.adminController.updateUserGoogleEmail(req, res));
// Delete user (soft delete)
router.delete("/users/:userId", (req, res) => admin_controller_1.adminController.deleteUser(req, res));
// Assign outlets to user
router.post("/users/:userId/outlets", (req, res) => admin_controller_1.adminController.assignOutlets(req, res));
router.post("/outlets", compliance_middleware_1.validateOnboarding, (req, res) => admin_controller_1.adminController.onboardOutlet(req, res));
router.post("/outlets/:outletId/subscription", compliance_middleware_1.validateSubscriptionUpdate, (req, res) => admin_controller_1.adminController.updateSubscription(req, res));
router.get("/outlets", (req, res) => admin_controller_1.adminController.getAllOutlets(req, res));
router.get("/reviews/manual-queue", (req, res) => admin_controller_1.adminController.getManualReviewQueue(req, res));
router.post("/reviews/:reviewId/manual-reply", (req, res) => admin_controller_1.adminController.submitManualReply(req, res));
// Google Business Profile integration
router.post("/outlets/:outletId/google/connect-link", (req, res) => admin_controller_1.adminController.generateGoogleConnectLink(req, res));
router.get("/outlets/:outletId/google/locations", (req, res) => integrations_controller_1.integrationsController.getGMBLocationsForOutlet(req, res));
router.post("/outlets/:outletId/google/link-location", (req, res) => admin_controller_1.adminController.linkGoogleLocation(req, res));
exports.default = router;
//# sourceMappingURL=admin.routes.js.map