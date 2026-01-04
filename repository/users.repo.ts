import { prisma } from "./base.repo"
import type { User, UserRole } from "@prisma/client"

/**
 * Get all non-deleted users
 */
export async function getAllUsers(): Promise<User[]> {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  })
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  })
}

/**
 * Create new user
 */
export async function createUser(data: {
  name: string
  email: string
  passwordHash: string
  role?: UserRole
  whatsappNumber?: string
  googleEmail?: string
  gmbAccountId?: string
}): Promise<User> {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role ?? "USER",
      whatsappNumber: data.whatsappNumber,
      googleEmail: data.googleEmail,
      gmbAccountId: data.gmbAccountId,
    },
  })
}

/**
 * Update user details
 */
export async function updateUser(id: string, data: Partial<User>): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  })
}

/**
 * Change user role (ADMIN <-> SUPER_ADMIN)
 */
export async function updateUserRole(id: string, role: UserRole): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      role,
      updatedAt: new Date(),
    },
  })
}

/**
 * Record login activity
 */
export async function updateLastLogin(id: string, ip?: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: ip,
      updatedAt: new Date(),
    },
  })
}

/**
 * Enable 2FA and store secret
 */
export async function enableTwoFactor(id: string, secret: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorVerified: false,
      updatedAt: new Date(),
    },
  })
}

/**
 * Mark 2FA secret as verified after OTP
 */
export async function verifyTwoFactor(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      twoFactorVerified: true,
      updatedAt: new Date(),
    },
  })
}

/**
 * Disable 2FA completely
 */
export async function disableTwoFactor(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorVerified: false,
      updatedAt: new Date(),
    },
  })
}

/**
 * Soft delete (recommended default)
 */
export async function softDeleteUser(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
  })
}

/**
 * Hard delete user record
 */
export async function deleteUser(id: string): Promise<User> {
  return prisma.user.delete({
    where: { id },
  })
}

// Export repository object with all methods
export const usersRepository = {
  getAllUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUser,
  updateUserRole,
  updateLastLogin,
  enableTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  softDeleteUser,
  deleteUser,
}
