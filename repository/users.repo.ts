import { prisma } from "../database";
import {
  User,
  UserRole
} from "@prisma/client";

export class UsersRepository {
  //
  // ----------- READ -----------
  //

  async getAll(limit = 50, offset = 0): Promise<User[]> {
    return prisma.user.findMany({
      where: { deletedAt: null },
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" }
    });
  }

  async getById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null }
    });
  }

  async getByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null }
    });
  }

  //
  // ----------- CREATE -----------
  //

  async createUser(data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
    whatsappNumber?: string;
    googleEmail?: string;
    gmbAccountId?: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // PREVENT duplicate/soft-deleted email conflicts
      const existing = await tx.user.findFirst({
        where: { email: data.email }
      });

      // If soft deleted, prevent ghost re-creation
      if (existing?.deletedAt) {
        throw new Error(
          "User with this email exists but is soft-deleted. Restore account instead of recreating."
        );
      }

      if (existing) {
        throw new Error("User with this email already exists");
      }

      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          passwordHash: data.passwordHash,
          role: data.role ?? "USER",
          whatsappNumber: data.whatsappNumber,
          googleEmail: data.googleEmail,
          gmbAccountId: data.gmbAccountId
        }
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "USER_CREATED",
          entity: "User",
          entityId: user.id
        }
      });

      return user;
    });
  }

  //
  // ----------- UPDATE -----------
  //

  async updateUser(id: string, data: Partial<User>) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { ...data, updatedAt: new Date() }
      });

      await tx.auditLog.create({
        data: {
          userId: id,
          action: "USER_UPDATED",
          entity: "User",
          entityId: id
        }
      });

      return updated;
    });
  }

  async updateUserRole(id: string, role: UserRole) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { role, updatedAt: new Date() }
      });

      await tx.auditLog.create({
        data: {
          userId: id,
          action: "USER_ROLE_UPDATED",
          entity: "User",
          entityId: id,
          details: `New role = ${role}`
        }
      });

      return user;
    });
  }

  async updateLastLogin(id: string, ip?: string) {
    return prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        updatedAt: new Date()
      }
    });
  }

  //
  // ----------- 2FA -----------
  //

  async enable2FA(id: string, secret: string) {
    return prisma.user.update({
      where: { id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
        twoFactorVerified: false,
        updatedAt: new Date()
      }
    });
  }

  async verify2FA(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        twoFactorVerified: true,
        updatedAt: new Date()
      }
    });
  }

  async disable2FA(id: string) {
    return prisma.user.update({
      where: { id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorVerified: false,
        updatedAt: new Date()
      }
    });
  }

  //
  // ----------- DELETE -----------
  //

  async softDelete(id: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          userId: id,
          action: "USER_SOFT_DELETED",
          entity: "User",
          entityId: id
        }
      });

      return user;
    });
  }

  async hardDelete(id: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.delete({
        where: { id }
      });

      await tx.auditLog.create({
        data: {
          userId: id,
          action: "USER_HARD_DELETED",
          entity: "User",
          entityId: id
        }
      });

      return user;
    });
  }

  // Compatibility aliases and helpers used by controllers (bridge from older API)

  // Legacy API compatibility
  async findByEmail(email: string) {
    return this.getByEmail(email);
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: UserRole;
    phoneNumber?: string;
    googleEmail?: string;
  }) {
    return this.createUser({
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      whatsappNumber: data.phoneNumber,
      googleEmail: data.googleEmail
    } as any);
  }

  async count() {
    return prisma.user.count({ where: { deletedAt: null } });
  }

  async updateRole(id: string, role: UserRole) {
    return this.updateUserRole(id, role);
  }

  async getUserById(id: string) {
    return this.getById(id);
  }

  async getUserByEmail(email: string) {
    return this.getByEmail(email);
  }

  async softDeleteUser(id: string) {
    return this.softDelete(id);
  }

  async hardDeleteUser(id: string) {
    return this.hardDelete(id);
  }

  async countSuperAdmins() {
    return prisma.user.count({ where: { role: 'SUPER_ADMIN', deletedAt: null } });
  }

  async assignOutlets(userId: string, outletIds: string[]) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        outlets: {
          connect: outletIds.map((id) => ({ id })),
        },
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string) {
    return prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const usersRepository = new UsersRepository();
