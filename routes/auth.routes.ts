import { Router, type Request, type Response } from "express"
import { authController, AuthController, type LoginRequest, type TwoFAVerifyRequest } from "../controllers/auth.controller"
import { requireAuth } from "../middleware/auth.middleware"
import { refreshController } from "../controllers/refresh.controller"

const router = Router()

/**
 * POST /api/auth/admin/login
 * Added separate admin login route
 */
router.post("/admin/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest

    if (!email || !password) {
      res.status(400).json({
        error: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      })
      return
    }

    await authController.loginAdmin(req, res)
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    })
  }
})

/**
 * POST /api/auth/user/login
 * Added separate user login route
 */
router.post("/user/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest

    if (!email || !password) {
      res.status(400).json({
        error: "Email and password are required",
        code: "MISSING_CREDENTIALS",
      })
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      res.status(400).json({
        error: "Invalid email format",
        code: "INVALID_EMAIL",
      })
      return
    }

    await authController.loginUser(req, res)
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    })
  }
})

  /**
   * POST /api/auth/login
   * Generic login endpoint for user-facing app
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      await authController.loginUser(req, res)
    } catch (err) {
      res.status(500).json({ error: "Internal server error" })
    }
  })

  /**
   * POST /api/auth/register
   * Create a new USER and sign in
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      await authController.register(req, res)
    } catch (err) {
      res.status(500).json({ error: "Internal server error" })
    }
  })

/**
 * POST /api/auth/two-factor/verify
 */
router.post("/two-factor/verify", async (req: Request, res: Response) => {
  try {
    const { email, token, tempToken } = req.body as TwoFAVerifyRequest

    if (!email || !token || !tempToken) {
      res.status(400).json({
        error: "Email, token, and tempToken are required",
        code: "MISSING_FIELDS",
      })
      return
    }

    if (!/^\d{6}$/.test(token)) {
      res.status(400).json({
        error: "Token must be a 6-digit numeric code",
        code: "INVALID_TOKEN_FORMAT",
      })
      return
    }

    await authController.verifyTwoFA(req, res)
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    })
  }
})

/**
 * POST /api/auth/logout
 */
router.post("/logout", requireAuth, async (req: Request, res: Response) => {
  try {
    await authController.logout(req, res)
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    })
  }
})

/**
 * GET /api/auth/me
 * Added endpoint to get current logged-in user info
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    await authController.getCurrentUser(req, res)
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    })
  }
})

/**
 * POST /api/auth/refresh
 * Rotate refresh token and issue new access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    await refreshController.rotate(req, res)
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' })
  }
})

/**
 * POST /api/auth/validate-password
 *
 * Validates password strength before user creation/reset
 */
router.post("/validate-password", (req: Request, res: Response) => {
  try {
    const { password } = req.body

    if (!password) {
      res.status(400).json({
        error: "Password is required",
        code: "MISSING_PASSWORD",
      })
      return
    }

    const result = AuthController.validatePasswordStrength(password)

    res.status(200).json(result)
  } catch (error) {
    res.status(500).json({
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    })
  }
})

export default router
