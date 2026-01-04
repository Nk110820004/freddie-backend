import "dotenv/config"
import { createServer } from "./index"
import { startAutomation } from "./workers/review-automation.worker"

const port = Number(process.env.PORT) || 3000

const app = createServer()

// Start background workers if enabled
try {
  startAutomation()
} catch (err) {
  console.error("Failed to start automation worker", err)
}

const server = app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📡 API available at http://localhost:${port}/api`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully...")
  server.close(() => {
    console.log("Server closed")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully...")
  server.close(() => {
    console.log("Server closed")
    process.exit(0)
  })
})
