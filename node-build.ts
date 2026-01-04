import path from "path";
import express from "express";
import { createServer } from "./index";

const app = createServer();
const port = process.env.PORT || 3000;

/**
 * Resolve __dirname safely for CommonJS
 */
const filename = (typeof (globalThis as any).__filename !== "undefined") ? (globalThis as any).__filename : process.argv[1];
const __dirname = path.dirname(filename || ".");

/**
 * Path to built frontend UI
 * ex: /dist/spa or /build depending on your setup
 */
const distPath = path.join(__dirname, "../spa");

// Serve static frontend assets
app.use(express.static(distPath));

/**
 * React Router fallback
 * - Any non-API route must serve index.html
 */
app.get("*", (req, res) => {
  // Do NOT hijack API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

/**
 * Start server
 */
const server = app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`🌐 UI served from /spa`);
  console.log(`🔌 API base: http://localhost:${port}/api`);
});

/**
 * Graceful shutdown
 */
function shutdown(signal: string) {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    console.log("✅ Server closed. Goodbye!");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
