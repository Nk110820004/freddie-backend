import { Router } from "express"
import { usersController } from "../controllers/users.controller"
import { requireAuth } from "../middleware/auth.middleware"
import { requireSuperAdmin, requireAdmin } from "../middleware/rbac.middleware"

const router = Router()

// all routes require authentication
router.use(requireAuth)

// -------- SUPER ADMIN ONLY --------

// create admin user
router.post("/", requireSuperAdmin, (req, res) => usersController.create(req, res))

// update user
router.put("/:id", requireSuperAdmin, (req, res) => usersController.update(req, res))

// delete user
router.delete("/:id", requireSuperAdmin, (req, res) => usersController.delete(req, res))

// -------- ADMIN & SUPER ADMIN --------

// get all users
router.get("/", requireAdmin, (req, res) => usersController.getAll(req, res))

// get user by ID
router.get("/:id", requireAdmin, (req, res) => usersController.getById(req, res))

// enroll 2FA
router.post("/:id/twofa/enroll", requireAdmin, (req, res) => usersController.enrollTwoFA(req, res))

// verify 2FA enrollment
router.post("/:id/twofa/verify", requireAdmin, (req, res) => usersController.verifyTwoFAEnrollment(req, res))

// change own password
router.post("/me/change-password", requireAuth, (req, res) => usersController.changePassword(req, res))

// get current user profile
router.get("/me/profile", requireAuth, (req, res) => usersController.getProfile(req, res))

// update current user profile
router.put("/me/profile", requireAuth, (req, res) => usersController.updateProfile(req, res))

export default router
