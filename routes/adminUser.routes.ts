import { Router } from "express"
import { createUser, getUsers, updateUser, deleteUser } from "../controllers/adminUser.controller"
import { requireAuth } from "../middleware/auth.middleware"
import { requireAdmin, requireSuperAdmin } from "../middleware/rbac.middleware"

const router = Router()

// require authenticated admin users
router.use(requireAuth)
router.use(requireAdmin)

// Create new admin user (SUPER_ADMIN only)
router.post("/", requireSuperAdmin, createUser)

// Get all users
router.get("/", getUsers)

// Update user
router.put("/:id", requireSuperAdmin, updateUser)

// Delete user (SUPER_ADMIN only)
router.delete("/:id", requireSuperAdmin, deleteUser)

export default router
