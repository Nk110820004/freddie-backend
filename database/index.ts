import { PrismaClient } from "@prisma/client"
import { logger } from "../utils/logger"

let prisma: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    })

    // Soft-delete enforcement: automatically exclude deleted users from queries
    prisma.$use(async (params, next) => {
      try {
        // Only apply for User model on read operations
        if (params.model === "User" && ["findMany", "findFirst", "count"].includes(params.action)) {
          if (!params.args) params.args = {}
          if (!params.args.where) params.args.where = {}

          // If caller explicitly set deletedAt in where, respect it
          if (params.args.where.deletedAt === undefined) {
            params.args.where = { ...params.args.where, deletedAt: null }
          }
        }
      } catch (err) {
        logger.warn("Prisma soft-delete middleware error", err)
      }

      return next(params)
    })

    prisma
      .$connect()
      .then(() => {
        logger.info("Prisma connected to database")
      })
      .catch((error) => {
        logger.error("Prisma connection error", error)
        process.exit(1)
      })
  }

  return prisma
}

export async function closePrismaClient(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
    logger.info("Prisma disconnected from database")
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing database connection")
  await closePrismaClient()
  process.exit(0)
})

process.on("SIGINT", async () => {
  logger.info("SIGINT received, closing database connection")
  await closePrismaClient()
  process.exit(0)
})

// Lazy initialization - db is accessed via getPrismaClient() when first needed
export const db = getPrismaClient()
