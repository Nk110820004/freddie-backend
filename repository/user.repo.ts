import { PrismaClient, type User, type UserRole } from "@prisma/client"

const prisma = new PrismaClient()

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email },
    })
  }

  async getAll(limit = 50, offset = 0) {
    return prisma.user.findMany({
      where: { deletedAt: null },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        twoFactorEnabled: true,
        createdAt: true,
        outlets: { select: { id: true, name: true } },
      },
    })
  }

  async create(data: {
    name: string
    email: string
    passwordHash: string
    role: UserRole
    phoneNumber?: string
    googleEmail?: string
  }): Promise<User> {
    return prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role,
        phoneNumber: data.phoneNumber,
        googleEmail: data.googleEmail,
      },
    })
  }

  async updateRole(id: string, role: UserRole): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { role },
    })
  }

  async softDelete(id: string): Promise<User> {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }

  async assignOutlets(userId: string, outletIds: string[]): Promise<void> {
    // Connect user to outlets
    await prisma.user.update({
      where: { id: userId },
      data: {
        outlets: {
          connect: outletIds.map((id) => ({ id })),
        },
      },
    })
  }

  async count(): Promise<number> {
    return prisma.user.count({ where: { deletedAt: null } })
  }
}

export const userRepository = new UserRepository()
