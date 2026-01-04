import type { Request, Response } from "express"
import { db } from "../database"
import { logger } from "../utils/logger"
import bcryptjs from "bcryptjs"
import { emailService } from "../services/email.service"

// CREATE USER
export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, phoneNumber, role, googleEmail } = req.body

    if (!email || !name || !role) {
      return res.status(400).json({ message: "Email, name, and role are required" })
    }

    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" })
    }

    const existing = await db.user.findUnique({
      where: { email },
    })

    if (existing) return res.status(409).json({ message: "User already exists" })

    const tempPassword = Math.random().toString(36).slice(-8)
    const passwordHash = await bcryptjs.hash(tempPassword, 10)

    const user = await db.user.create({
      data: {
        name,
        email,
        googleEmail,
        phoneNumber,
        passwordHash,
        role,
      },
    })

    await emailService.sendOnboardingEmail(email, name, tempPassword)
    logger.info(`New admin user created and notified: ${email} with role ${role}`)

    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      tempPassword,
      message: "User created successfully. Password sent via email.",
    })
  } catch (err) {
    logger.error("Failed to create user", err)
    res.status(500).json({ message: "Failed to create user" })
  }
}

// GET ALL USERS
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await db.user.findMany({
      where: { deletedAt: null },
      include: { outlets: true },
    })

    res.json(users)
  } catch (err) {
    logger.error("Error fetching users", err)
    res.status(500).json({ message: "Failed to fetch users" })
  }
}

// UPDATE USER
export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, phoneNumber, googleEmail, role } = req.body

    if (!id) {
      return res.status(400).json({ message: "User ID is required" })
    }

    const user = await db.user.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(phoneNumber && { phoneNumber }),
        ...(googleEmail && { googleEmail }),
        ...(role && { role }),
      },
    })

    res.json({
      message: "User updated successfully",
      user,
    })
  } catch (err) {
    logger.error("Failed to update user", err)
    res.status(500).json({ message: "Failed to update user" })
  }
}

// DELETE USER (SOFT DELETE)
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    if (!id) {
      return res.status(400).json({ message: "User ID is required" })
    }

    await db.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    res.json({ message: "User deleted successfully" })
  } catch (err) {
    logger.error("Delete user failed", err)
    res.status(500).json({ message: "Failed to delete user" })
  }
}
