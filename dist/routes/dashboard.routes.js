"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dashboard_controller_1 = require("../controllers/dashboard.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.requireAuth);
router.get("/metrics", rbac_middleware_1.requireAdmin, (req, res) => dashboard_controller_1.dashboardController.getMetrics(req, res));
router.get("/activities", rbac_middleware_1.requireAdmin, (req, res) => dashboard_controller_1.dashboardController.getRecentActivities(req, res));
exports.default = router;
//# sourceMappingURL=dashboard.routes.js.map