"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const env_1 = __importDefault(require("./config/env"));
// -------- Middlewares --------
// import { checkIpAllowlist } from "./middleware/ipAllowlist.middleware"
// -------- Route Modules --------
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const dashboard_routes_1 = __importDefault(require("./routes/dashboard.routes"));
const rbac_routes_1 = __importDefault(require("./routes/rbac.routes"));
const adminUser_routes_1 = __importDefault(require("./routes/adminUser.routes"));
const users_routes_1 = __importDefault(require("./routes/users.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const outlets_routes_1 = __importDefault(require("./routes/outlets.routes"));
const billing_routes_1 = __importDefault(require("./routes/billing.routes"));
const reviews_routes_1 = __importDefault(require("./routes/reviews.routes"));
const security_routes_1 = __importDefault(require("./routes/security.routes"));
const audit_routes_1 = __importDefault(require("./routes/audit.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const integrations_routes_1 = __importDefault(require("./routes/integrations.routes"));
const logger_1 = require("./utils/logger"); // <- safe if exists
function createServer() {
    const app = (0, express_1.default)();
    // ---------- Global Middleware ----------
    app.use((0, cors_1.default)({ origin: [env_1.default.ADMIN_PANEL_URL, env_1.default.USER_APP_URL], credentials: true }));
    app.use((0, cookie_parser_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // ---------- Basic Public Health Routes ----------
    app.get("/api/ping", (_req, res) => {
        res.json({
            message: process.env.PING_MESSAGE ?? "pong",
            timestamp: new Date().toISOString(),
        });
    });
    app.get("/api/health", (_req, res) => {
        res.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            env: process.env.NODE_ENV ?? "development",
        });
    });
    app.get("/admin", (req, res) => res.redirect("/admin/login"));
    app.get("/user", (req, res) => res.redirect("/user/login"));
    // ---------- Apply IP Allow-list for Admin Console ----------
    // Everything below this line is *admin-only*
    // app.use(checkIpAllowlist)
    // ---------- API Routes ----------
    app.use("/api/auth", auth_routes_1.default);
    app.use("/api/user", user_routes_1.default);
    app.use("/api/users", users_routes_1.default);
    app.use("/api/admin/users", adminUser_routes_1.default);
    app.use("/api/dashboard", dashboard_routes_1.default);
    app.use("/api/rbac", rbac_routes_1.default);
    app.use("/api/outlets", outlets_routes_1.default);
    app.use("/api/billing", billing_routes_1.default);
    app.use("/api/reviews", reviews_routes_1.default);
    app.use("/api/security", security_routes_1.default);
    app.use("/api/audit-logs", audit_routes_1.default);
    app.use("/api/admin", admin_routes_1.default);
    app.use("/api/payments", payment_routes_1.default);
    app.use("/api/integrations", integrations_routes_1.default);
    // ---------- 404 ----------
    app.use((_req, res) => {
        res.status(404).json({
            error: "Not found",
            message: "The requested resource was not found",
        });
    });
    // ---------- Global Error Handler ----------
    app.use((err, _req, res, _next) => {
        try {
            logger_1.logger?.error("Unhandled error", err);
        }
        catch {
            console.error("Unhandled error", err);
        }
        res.status(err.status || 500).json({
            error: "Internal server error",
            message: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    });
    return app;
}
//# sourceMappingURL=index.js.map