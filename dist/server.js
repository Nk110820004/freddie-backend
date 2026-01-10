"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const index_1 = require("./index");
const database_1 = require("./database");
const review_automation_worker_1 = require("./workers/review-automation.worker");
const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);
if (Number.isNaN(port)) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
}
async function bootstrap() {
    const app = (0, index_1.createServer)();
    // Start background automation engine
    try {
        await (0, review_automation_worker_1.startAutomation)();
        console.log("🤖 Automation worker started");
    }
    catch (err) {
        console.error("❌ Failed to start automation worker", err);
    }
    const server = app.listen(port, () => {
        console.log(`🚀 Server running on http://localhost:${port}`);
        console.log(`📡 API available at http://localhost:${port}/api`);
    });
    // ---- graceful shutdown routine ----
    const shutdown = async (signal) => {
        console.log(`${signal} received, shutting down gracefully...`);
        try {
            await (0, review_automation_worker_1.stopAutomation)();
            console.log("🛑 Automation worker stopped");
        }
        catch (err) {
            console.error("⚠️ Error stopping automation worker", err);
        }
        server.close(async () => {
            console.log("HTTP server closed");
            try {
                await database_1.prisma.$disconnect();
                console.log("🗄️ Prisma disconnected");
            }
            catch (err) {
                console.error("⚠️ Error disconnecting Prisma", err);
            }
            process.exit(0);
        });
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    // ---- critical process-level handlers ----
    process.on("unhandledRejection", (reason) => {
        console.error("UNHANDLED PROMISE REJECTION:", reason);
    });
    process.on("uncaughtException", (err) => {
        console.error("UNCAUGHT EXCEPTION:", err);
    });
}
bootstrap().catch((err) => {
    console.error("❌ Fatal startup error", err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map