import type { Response } from "express"
import { userRepository } from "../repository/user.repo"
import { logger } from "../utils/logger"
import bcryptjs from "bcryptjs"
import type { AuthRequest } from "../middleware/auth.middleware"
import crypto from "crypto"
import { outletsRepository } from "../repository/outlets.repo"
import { ManualReviewQueueRepository } from "../repository/manual-review-queue.repo"
import { prisma } from "../database" // assuming prisma client is here
import { billingRepository } from "../repository/billing.repo"
import { googleConnectTokenRepository } from "../repository/google-connect-token.repo"
import { integrationsController } from "./integrations.controller"
import { gmbService } from "../integrations/gmb.js"
import { whatsappService } from "../integrations/whatsapp"
import { emailService } from "../services/email.service"

const outletRepo = outletsRepository
const manualQueueRepo = new ManualReviewQueueRepository(prisma)

export class AdminController {
  async createUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, email, role, phoneNumber, googleEmail, outletIds } = req.body

      // Validate input
      if (!name || !email || !role) {
        res.status(400).json({ error: "Name, email, and role are required" })
        return
      }

      // Check if user exists
      const existing = await userRepository.findByEmail(email)
      if (existing) {
        res.status(409).json({ error: "User already exists" })
        return
      }

      // Generate random password (user will reset on first login)
      const tempPassword = Math.random().toString(36).slice(-12)
      const passwordHash = await bcryptjs.hash(tempPassword, 10)

      const user = await userRepository.create({
        name,
        email,
        passwordHash,
        role,
        phoneNumber,
        googleEmail,
      })

      // Assign outlets if provided
      if (outletIds && outletIds.length > 0) {
        await userRepository.assignOutlets(user.id, outletIds)
      }

      logger.info(`User created: ${user.id}`, { email, role })

      res.status(201).json({
        message: "User created successfully",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } catch (error) {
      logger.error("Failed to create user", error)
      res.status(500).json({ error: "Failed to create user" })
    }
  }

  async getUsers(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { limit = "50", offset = "0" } = req.query

      const users = await userRepository.getAll(Number.parseInt(limit as string), Number.parseInt(offset as string))
      const total = await userRepository.count()

      res.status(200).json({
        users,
        total,
        limit: Number.parseInt(limit as string),
        offset: Number.parseInt(offset as string),
      })
    } catch (error) {
      logger.error("Failed to fetch users", error)
      res.status(500).json({ error: "Failed to fetch users" })
    }
  }

  async updateUserRole(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { role } = req.body

      if (!role) {
        res.status(400).json({ error: "Role is required" })
        return
      }

      const user = await userRepository.updateRole(userId, role)

      logger.info(`User role updated: ${userId}`, { role })

      res.status(200).json({
        message: "User role updated",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      })
    } catch (error) {
      logger.error("Failed to update user role", error)
      res.status(500).json({ error: "Failed to update user role" })
    }
  }

  async updateUserGoogleEmail(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { googleEmail } = req.body

      if (!googleEmail) {
        res.status(400).json({ error: "googleEmail is required" })
        return
      }

      const user = await userRepository.updateUser(userId, { googleEmail })

      logger.info(`User Google email updated: ${userId}`, { googleEmail })

      res.status(200).json({
        message: "User Google email updated",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          googleEmail: user.googleEmail,
        },
      })
    } catch (error) {
      logger.error("Failed to update user Google email", error)
      res.status(500).json({ error: "Failed to update user Google email" })
    }
  }

  async deleteUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params

      const user = await userRepository.softDelete(userId)

      logger.info(`User deleted: ${userId}`)

      res.status(200).json({ message: "User deleted successfully" })
    } catch (error) {
      logger.error("Failed to delete user", error)
      res.status(500).json({ error: "Failed to delete user" })
    }
  }

  async assignOutlets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { outletIds } = req.body

      if (!outletIds || !Array.isArray(outletIds)) {
        res.status(400).json({ error: "outletIds array is required" })
        return
      }

      await userRepository.assignOutlets(userId, outletIds)

      logger.info(`Outlets assigned to user: ${userId}`, { outletIds })

      res.status(200).json({ message: "Outlets assigned successfully" })
    } catch (error) {
      logger.error("Failed to assign outlets", error)
      res.status(500).json({ error: "Failed to assign outlets" })
    }
  }

  async onboardUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        email,
        whatsappNumber,
        gmbOutletId,
        outletName,
        subscriptionPlan = "MONTHLY",
        subscriptionStatus = "TRIAL",
        category = "OTHER",
      } = req.body

      // Validate required fields per prompt
      if (!name || !email || !whatsappNumber || !outletName) {
        res.status(400).json({ error: "Name, email, WhatsApp, and outlet name are required" })
        return
      }

      // Check if user exists
      const existing = await userRepository.findByEmail(email.toLowerCase())
      if (existing) {
        res.status(409).json({ error: "User already exists" })
        return
      }

      // Generate credentials
      const tempPassword = crypto.randomBytes(8).toString("hex")
      const passwordHash = await bcryptjs.hash(tempPassword, 12)

      // 1. Create User
      const user = await userRepository.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "USER",
        phoneNumber: whatsappNumber,
      })

      // 2. Create Outlet via new repository with rules
      const outlet = await outletRepo.createOutlet({
        name: outletName,
        userId: user.id,
        primaryContactName: name,
        contactEmail: email.toLowerCase(),
        contactPhone: whatsappNumber,
        category: category as any,
        subscriptionPlan: subscriptionPlan as any,
        subscriptionStatus: subscriptionStatus as any,
        googlePlaceId: gmbOutletId,
      })

      // 3. Log onboarding
      logger.info(`User onboarded: ${user.id} with outlet ${outlet.id}`)

      res.status(201).json({
        message: "User onboarded successfully",
        credentials: {
          email: user.email,
          password: tempPassword,
          loginUrl: "/user/login",
        },
        user,
        outlet,
      })
    } catch (error) {
      logger.error("Failed to onboard user", error)
      res.status(500).json({ error: "Failed to onboard user" })
    }
  }

  async onboardOutlet(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        name,
        email,
        whatsappNumber,
        gmbOutletId,
        outletName,
        groupName,
        subscriptionPlan = "MONTHLY",
        subscriptionStatus = "TRIAL",
        category = "OTHER",
      } = req.body

      // Validate required fields per requirements
      if (!name || !email || !whatsappNumber || !outletName) {
        res.status(400).json({
          error: "Incomplete onboarding data",
          message: "Name, email, WhatsApp number, and outlet name are required",
        })
        return
      }

      // Check if user exists
      const existing = await userRepository.findByEmail(email.toLowerCase())
      if (existing) {
        res.status(409).json({ error: "User with this email already exists" })
        return
      }

      // Generate secure temporary credentials
      const tempPassword = crypto.randomBytes(12).toString("hex")
      const passwordHash = await bcryptjs.hash(tempPassword, 12)

      // Create user
      const user = await userRepository.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: "USER",
        phoneNumber: whatsappNumber,
      })

      // Create outlet with business rule enforcement
      const outlet = await outletRepo.createOutlet({
        name: outletName,
        groupName,
        userId: user.id,
        primaryContactName: name,
        contactEmail: email.toLowerCase(),
        contactPhone: whatsappNumber,
        category: category as any,
        subscriptionPlan: subscriptionPlan as any,
        subscriptionStatus: subscriptionStatus as any,
        googlePlaceId: gmbOutletId,
        googleLocationName: gmbOutletId,
      })

      // Complete onboarding if all fields are present
      if (subscriptionStatus !== "UNPAID") {
        await outletRepo.completeOnboarding(outlet.id)
      }

      logger.info(`Outlet onboarded: ${outlet.id} for user ${user.id}`)

      res.status(201).json({
        message: "Outlet onboarded successfully",
        credentials: {
          email: user.email,
          password: tempPassword,
          loginUrl: "/user/login",
        },
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        outlet: {
          id: outlet.id,
          name: outlet.name,
          subscriptionStatus: outlet.subscriptionStatus,
          apiStatus: outlet.apiStatus,
          onboardingStatus: outlet.onboardingStatus,
        },
      })
    } catch (error) {
      logger.error("Failed to onboard outlet", error)
      res.status(500).json({ error: "Failed to onboard outlet" })
    }
  }

  async updateSubscription(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { outletId } = req.params
      const { subscriptionStatus, billingStatus, apiStatus, remarks } = req.body

      if (!req.userId) {
        res.status(401).json({ error: "Unauthorized" })
        return
      }

      if (!remarks) {
        res.status(400).json({
          error: "Remarks are required",
          message: "Admin remarks must be provided for subscription updates",
        })
        return
      }

      // Validate outlet exists
      const outlet = await outletRepo.getOutletById(outletId)
      if (!outlet) {
        res.status(404).json({ error: "Outlet not found" })
        return
      }

      // Update with business rule enforcement and audit trail
      const updated = await outletRepo.update(outletId, {
        subscriptionStatus,
        apiStatus,
      })

      if (billingStatus) {
        await billingRepository.updateSubscriptionStatus(outletId, billingStatus)
      }

      logger.info(`Subscription updated for outlet ${outletId} by admin ${req.userId}`)

      res.status(200).json({
        message: "Subscription updated successfully",
        outlet: {
          id: updated.id,
          name: updated.name,
          subscriptionStatus: updated.subscriptionStatus,
          apiStatus: updated.apiStatus,
        },
      })
    } catch (error) {
      logger.error("Failed to update subscription", error)
      res.status(400).json({
        error: error instanceof Error ? error.message : "Subscription update failed",
      })
    }
  }

  async getAllOutlets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const outlets = await outletRepo.getAllOutlets()

      res.status(200).json({
        outlets,
        total: outlets.length,
      })
    } catch (error) {
      logger.error("Failed to fetch outlets", error)
      res.status(500).json({ error: "Failed to fetch outlets" })
    }
  }

  async getManualReviewQueue(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status } = req.query

      const whereClause: any = {}

      if (status) {
        whereClause.status = status
      }

      const queue = await prisma.manualReviewQueue.findMany({
        where: whereClause,
        include: {
          review: {
            include: {
              outlet: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          assignedAdmin: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      })

      res.status(200).json({
        queue,
        total: queue.length,
      })
    } catch (error) {
      logger.error("Failed to fetch manual review queue", error)
      res.status(500).json({ error: "Failed to fetch manual review queue" })
    }
  }

  async submitManualReply(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { reviewId } = req.params
      const { replyText } = req.body

      if (!replyText || typeof replyText !== "string" || replyText.trim().length === 0) {
        res.status(400).json({ error: "Reply text is required" })
        return
      }

      // Get review and queue item
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          outlet: {
            include: {
              user: true,
            },
          },
          manualQueue: true,
        },
      })

      if (!review) {
        res.status(404).json({ error: "Review not found" })
        return
      }

      // Update review with manual reply
      await prisma.review.update({
        where: { id: reviewId },
        data: {
          manualReplyText: replyText,
          status: "CLOSED",
        },
      })

      // Mark queue item as responded
      if (review.manualQueue) {
        await manualQueueRepo.markAsResponded(review.manualQueue.id)
      }

      // Post to GMB if credentials available
      if (review.outlet.user.googleRefreshToken && review.outlet.googleLocationName && review.googleReviewId) {
        const { gmbService } = await import("../integrations/gmb.js")
        await gmbService.postReply(
          review.outlet.googleLocationName,
          review.googleReviewId,
          replyText,
          review.outlet.user.googleRefreshToken,
        )
      }

      logger.info(`Manual reply submitted for review ${reviewId} by admin ${req.userId}`)

      res.status(200).json({
        message: "Manual reply submitted successfully",
        review: {
          id: review.id,
          status: "CLOSED",
        },
      })
    } catch (error) {
      logger.error("Failed to submit manual reply", error)
      res.status(500).json({ error: "Failed to submit manual reply" })
    }
  }

  /**
   * Generate Google connect link for an outlet
   */
  async generateGoogleConnectLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { outletId } = req.params

      if (!outletId) {
        res.status(400).json({ error: "Outlet ID is required" })
        return
      }

      // Verify outlet exists
      const outlet = await outletRepo.getById(outletId)
      if (!outlet) {
        res.status(404).json({ error: "Outlet not found" })
        return
      }

      // Generate random token
      const token = crypto.randomBytes(32).toString('hex')

      // Create token with 15 minute expiry
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 15)

      await googleConnectTokenRepository.create({
        outletId,
        token,
        expiresAt
      })

      // Generate connect URL
      const connectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/connect-google?token=${token}`

      logger.info(`Google connect link generated for outlet: ${outletId}`)

      res.status(200).json({
        connectUrl
      })
    } catch (error) {
      logger.error("Failed to generate Google connect link", error)
      res.status(500).json({ error: "Failed to generate connect link" })
    }
  }

  /**
   * Link Google location to outlet
   */
  async linkGoogleLocation(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { outletId } = req.params
      const { googleLocationName, placeId } = req.body

      if (!outletId || !googleLocationName || !placeId) {
        res.status(400).json({ error: "Outlet ID, Google location name, and place ID are required" })
        return
      }

      // Verify outlet exists
      const outlet = await outletRepo.getById(outletId)
      if (!outlet) {
        res.status(404).json({ error: "Outlet not found" })
        return
      }

      // Update outlet with Google location info
      await outletRepo.setGoogleConnected(outletId, placeId, googleLocationName)

      logger.info(`Google location linked to outlet: ${outletId}, location: ${googleLocationName}`)

      res.status(200).json({
        message: "Google location linked successfully",
        outlet: {
          id: outletId,
          googleLocationName,
          placeId,
          googleConnected: true
        }
      })
    } catch (error) {
      logger.error("Failed to link Google location", error)
      res.status(500).json({ error: "Failed to link Google location" })
    }
  }

  /**
   * Step 2: Generate and send Google Connect Link
   * Supports WhatsApp, Email, and manual copy
   */
  async sendGoogleConnectLink(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId, channel } = req.body // channel: 'whatsapp' | 'email' | 'manual'

      if (!userId) {
        res.status(400).json({ error: "User ID is required" })
        return
      }

      const user = await userRepository.getUserById(userId)
      if (!user) {
        res.status(404).json({ error: "User not found" })
        return
      }

      // Generate or get existing valid token
      let tokenItem = await googleConnectTokenRepository.findLatestByUserId(userId)
      let token: string

      if (tokenItem && tokenItem.expiresAt > new Date() && !tokenItem.usedAt) {
        token = tokenItem.token
      } else {
        token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date()
        expiresAt.setMinutes(expiresAt.getMinutes() + 15)
        tokenItem = await googleConnectTokenRepository.create({
          userId,
          token,
          expiresAt
        })
      }

      const connectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/connect-google?token=${token}`

      let sent = false
      if (channel === 'whatsapp' && user.phoneNumber) {
        // TODO: Create a dedicated WhatsApp template for this action
        const waResult = await whatsappService.sendTemplate(
          user.phoneNumber,
          "freddie_manual_review_reminder_v1", // Using existing template for now
          "en_US",
          // Params: 1: user name, 2: item, 3: status, 4: details
          [user.name || 'there', "Google Account", "Connection Link", connectUrl]
        )
        sent = waResult.ok
      } else if (channel === 'email' && user.email) {
        // You might want to add a specific method for this in emailService
        // For now using a generic log or placeholder
        logger.info(`Email with connect link would be sent to ${user.email}`)
        sent = true 
      } else if (channel === 'manual') {
        sent = true
      }

      if (sent) {
        await googleConnectTokenRepository.updateLastSentAt(token)
      }

      res.status(200).json({
        message: "Connect link processed",
        connectUrl,
        sent,
        lastSentAt: new Date(),
        expiresIn: Math.round((tokenItem.expiresAt.getTime() - Date.now()) / 60000)
      })
    } catch (error) {
      logger.error("Failed to send Google connect link", error)
      res.status(500).json({ error: "Failed to process connect link" })
    }
  }

  /**
   * Step 3: Get locations after OAuth is complete
   */
  async getLocationsForUser(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const user = await userRepository.getUserById(userId)

      if (!user || !user.googleRefreshToken) {
        res.status(400).json({ error: "Google account not connected for this user" })
        return
      }

      const locations = await gmbService.fetchLocationsForOutlet(user.googleRefreshToken)
      
      res.status(200).json({ locations })
    } catch (error) {
      logger.error("Failed to fetch locations for user", error)
      res.status(500).json({ error: "Failed to fetch Google locations" })
    }
  }

  /**
   * Step 4: Enable multiple outlets and configure them
   */
  async enableOutletsBulk(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { userId, outlets } = req.body 
      // outlets: Array<{ googleLocationName: string, name: string, category: string, plan: string }>

      if (!userId || !outlets || !Array.isArray(outlets)) {
        res.status(400).json({ error: "User ID and outlets array are required" })
        return
      }

      const results = []
      for (const o of outlets) {
        const outlet = await outletRepo.createOutlet({
          name: o.name,
          userId,
          primaryContactName: "Owner", // Default
          contactEmail: `${o.googleLocationName.split('/').pop()}@placeholder.com`, // Better way needed
          contactPhone: "0000000000",
          category: (o.category || "OTHER") as any,
          subscriptionPlan: (o.plan || "MONTHLY") as any,
          googleLocationName: o.googleLocationName,
          googleConnected: true,
          onboardingStatus: "COMPLETED",
          apiStatus: "ENABLED"
        })
        results.push(outlet)
      }

      res.status(201).json({
        message: `${results.length} outlets enabled successfully`,
        outlets: results
      })
    } catch (error) {
      logger.error("Failed to enable outlets bulk", error)
      res.status(500).json({ error: "Failed to enable outlets" })
    }
  }
}

export const adminController = new AdminController()
