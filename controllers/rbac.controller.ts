import type { Request, Response } from "express"
import { db } from "../database"
import { logger } from "../utils/logger"
import bcryptjs from "bcryptjs"

class RBACController {
  // GET ALL ADMINS
  async getAdminUsers(_req: Request, res: Response) {
    try {
      const users = await db.user.findMany({
        where: {
          deletedAt: null,
        },
        include: {
          outlets: true,
        },
      })

      res.json(users)
    } catch (err) {
      logger.error("Error fetching admin users", err)
      res.status(500).json({ message: "Failed to fetch users" })
    }
  }

  // UPDATE USER ROLE
  async updateUserRole(req: Request, res: Response) {
    try {
      const { userId, role } = req.body

      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" })
      }

      const user = await db.user.update({
        where: { id: userId },
        data: { role },
      })

      res.json({
        message: "Role updated successfully",
        user,
      })
    } catch (err) {
      logger.error("Failed to update user role", err)
      res.status(500).json({ message: "Failed to update user role" })
    }
  }

  async inviteUser(req: Request, res: Response) {
    try {
      const { email, role } = req.body

      if (!email || !role) {
        return res.status(400).json({ message: "Email and role are required" })
      }

      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        return res.status(400).json({ message: "Invalid role" })
      }

      // Check if user already exists
      const existingUser = await db.user.findUnique({
        where: { email },
      })

      if (existingUser) {
        return res.status(409).json({ message: "User already exists" })
      }

      // Create temporary password for new user
      const tempPassword = Math.random().toString(36).slice(-12)
      const passwordHash = await bcryptjs.hash(tempPassword, 10)

      const newUser = await db.user.create({
        data: {
          name: email.split("@")[0],
          email,
          role,
          passwordHash,
        },
      })

      // In production, send invitation email with temp password
      logger.info(`User invited: ${email} with role ${role}`)

      res.status(201).json({
        message: "Invitation sent successfully",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      })
    } catch (err) {
      logger.error("Failed to invite user", err)
      res.status(500).json({ message: "Failed to invite user" })
    }
  }

  // TOGGLE 2FA
  async toggleTwoFA(req: Request, res: Response) {
    try {
      const { userId, enabled } = req.body

      const user = await db.user.update({
        where: { id: userId },
        data: {
          twoFactorEnabled: enabled,
          twoFactorVerified: enabled,
        },
      })

      res.json({
        message: "2FA status updated",
        user,
      })
    } catch (err) {
      logger.error("2FA toggle failed", err)
      res.status(500).json({ message: "Failed to toggle 2FA" })
    }
  }

  // DELETE USER
  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params

      await db.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      })

      res.json({ message: "User deleted" })
    } catch (err) {
      logger.error("Delete user failed", err)
      res.status(500).json({ message: "Failed to delete user" })
    }
  }

  async getRoles(req: Request, res: Response): Promise<void> {
    try {
      // Since roles are an enum in Prisma, we return the supported set
      const roles = [
        { id: "SUPER_ADMIN", name: "Super Administrator", description: "Full system access" },
        { id: "ADMIN", name: "Administrator", description: "Manage outlets and users" },
      ]
      res.status(200).json(roles)
    } catch (error) {
      logger.error("Failed to get roles", error)
      res.status(500).json({ error: "Failed to retrieve roles" })
    }
  }

  async assignRole(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params
      const { role } = req.body

      if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
        res.status(400).json({ error: "Invalid role" })
        return
      }

      const user = await db.user.update({
        where: { id: userId },
        data: { role },
      })

      logger.info(`Role ${role} assigned to user ${userId}`)
      res.status(200).json({ message: "Role assigned successfully", user: { id: user.id, role: user.role } })
    } catch (error) {
      logger.error("Failed to assign role", error)
      res.status(500).json({ error: "Failed to assign role" })
    }
  }
}

export const rbacController = new RBACController()
