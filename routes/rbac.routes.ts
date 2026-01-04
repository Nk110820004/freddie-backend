import { Router } from "express"
import { rbacController } from "../controllers/rbac.controller"
import { requireAuth } from "../middleware/auth.middleware"
import { requireSuperAdmin } from "../middleware/rbac.middleware"

const router = Router()

router.use(requireAuth)

router.get("/users", (req, res) => rbacController.getAdminUsers(req, res))

router.post("/user/role", (req, res) => rbacController.updateUserRole(req, res))

router.post("/invite", requireSuperAdmin, (req, res) => rbacController.inviteUser(req, res))

router.post("/user/twofa", (req, res) => rbacController.toggleTwoFA(req, res))

router.delete("/user/:id", (req, res) => rbacController.deleteUser(req, res))

router.get("/roles", requireSuperAdmin, (req, res) => rbacController.getRoles(req, res))

router.post("/users/:userId/role", requireSuperAdmin, (req, res) => rbacController.assignRole(req, res))

export default router
