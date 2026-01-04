import { Router } from "express";
import { dashboardController } from "../controllers/dashboard.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireAdmin } from "../middleware/rbac.middleware";

const router = Router();

router.use(requireAuth);

router.get("/metrics", requireAdmin, (req, res) =>
  dashboardController.getMetrics(req, res)
);

router.get("/activities", requireAdmin, (req, res) =>
  dashboardController.getRecentActivities(req, res)
);

export default router;
