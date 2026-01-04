import "dotenv/config"
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import env from "./config/env"

// -------- Middlewares --------
// import { checkIpAllowlist } from "./middleware/ipAllowlist.middleware"

// -------- Route Modules --------
import authRoutes from "./routes/auth.routes"
import dashboardRoutes from "./routes/dashboard.routes"
import rbacRoutes from "./routes/rbac.routes"
import adminUserRoutes from "./routes/adminUser.routes"
import usersRoutes from "./routes/users.routes"
import userRoutes from "./routes/user.routes"
import outletsRoutes from "./routes/outlets.routes"
import billingRoutes from "./routes/billing.routes"
import reviewsRoutes from "./routes/reviews.routes"
import securityRoutes from "./routes/security.routes"
import auditRoutes from "./routes/audit.routes"
import adminRoutes from "./routes/admin.routes"
import paymentRoutes from "./routes/payment.routes"
import integrationsRoutes from "./routes/integrations.routes"

import { logger } from "./utils/logger" // <- safe if exists

export function createServer() {
  const app = express()

  // ---------- Global Middleware ----------
  app.use(cors({ origin: [env.ADMIN_PANEL_URL, env.USER_APP_URL], credentials: true }))
  app.use(cookieParser())
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  // ---------- Basic Public Health Routes ----------
  app.get("/api/ping", (_req, res) => {
    res.json({
      message: process.env.PING_MESSAGE ?? "pong",
      timestamp: new Date().toISOString(),
    })
  })

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      env: process.env.NODE_ENV ?? "development",
    })
  })

  app.get("/admin", (req, res) => res.redirect("/admin/login"))
  app.get("/user", (req, res) => res.redirect("/user/login"))

  // ---------- Apply IP Allow-list for Admin Console ----------
  // Everything below this line is *admin-only*
  // app.use(checkIpAllowlist)

  // ---------- API Routes ----------
  app.use("/api/auth", authRoutes)
  app.use("/api/user", userRoutes)
  app.use("/api/users", usersRoutes)
  app.use("/api/admin/users", adminUserRoutes)
  app.use("/api/dashboard", dashboardRoutes)
  app.use("/api/rbac", rbacRoutes)
  app.use("/api/outlets", outletsRoutes)
  app.use("/api/billing", billingRoutes)
  app.use("/api/reviews", reviewsRoutes)
  app.use("/api/security", securityRoutes)
  app.use("/api/audit-logs", auditRoutes)
  app.use("/api/admin", adminRoutes)
  app.use("/api/payments", paymentRoutes)
  app.use("/api/integrations", integrationsRoutes)

  // ---------- 404 ----------
  app.use((_req, res) => {
    res.status(404).json({
      error: "Not found",
      message: "The requested resource was not found",
    })
  })

  // ---------- Global Error Handler ----------
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    try {
      logger?.error("Unhandled error", err)
    } catch {
      console.error("Unhandled error", err)
    }

    res.status(err.status || 500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    })
  })

  return app
}
