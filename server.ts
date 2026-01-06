import "dotenv/config";
import { createServer } from "./index";
import { prisma } from "./database";
import {
  startAutomation,
  stopAutomation
} from "./workers/review-automation.worker";

const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port)) {
  throw new Error(`Invalid PORT value: ${rawPort}`);
}

async function bootstrap() {
  const app = createServer();

  // Start background automation engine
  try {
    await startAutomation();
    console.log("🤖 Automation worker started");
  } catch (err) {
    console.error("❌ Failed to start automation worker", err);
  }

  const server = app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
    console.log(`📡 API available at http://localhost:${port}/api`);
  });

  // ---- graceful shutdown routine ----
  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);

    try {
      await stopAutomation();
      console.log("🛑 Automation worker stopped");
    } catch (err) {
      console.error("⚠️ Error stopping automation worker", err);
    }

    server.close(async () => {
      console.log("HTTP server closed");

      try {
        await prisma.$disconnect();
        console.log("🗄️ Prisma disconnected");
      } catch (err) {
        console.error("⚠️ Error disconnecting Prisma", err);
      }

      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ---- critical process-level handlers ----
  process.on("unhandledRejection", (reason: any) => {
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
