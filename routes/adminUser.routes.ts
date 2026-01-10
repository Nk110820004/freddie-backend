import { Router } from "express"
import { adminUserController } from "../controllers/adminUser.controller"
import { requireAuth } from "../middleware/auth.middleware"
import { requireAdmin, requireSuperAdmin } from "../middleware/rbac.middleware"

const router = Router()

// require authenticated admin users
router.use(requireAuth)
router.use(requireAdmin)

// Create new admin user (SUPER_ADMIN only)
router.post("/", requireSuperAdmin, (req, res) => adminUserController.create(req, res))

// Get all users
router.get("/", (req, res) => adminUserController.getUsers(req, res))

// Update user
router.put("/:id", requireSuperAdmin, (req, res) => adminUserController.updateUser(req, res))

// Delete user (SUPER_ADMIN only)
router.delete("/:id", requireSuperAdmin, (req, res) => adminUserController.deleteUser(req, res))

export default router
