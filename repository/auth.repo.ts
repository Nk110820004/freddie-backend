import { db } from '../database';
import { User } from '@prisma/client';

export class AuthRepository {
  async getUserByEmail(email: string): Promise<User | null> {
    return db.user.findFirst({
      where: {
        email: email.toLowerCase(),
        deletedAt: null,
      },
    });
  }

  async updateLastLogin(id: string, ip?: string): Promise<void> {
    await db.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip || null,
      },
    });
  }

  async saveTwoFactorSecret(id: string, secret: string): Promise<void> {
    await db.user.update({
      where: { id },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: true,
        twoFactorVerified: true,
      },
    });
  }
}

export const authRepository = new AuthRepository();
