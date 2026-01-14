import { prisma } from '../database';
import { GoogleConnectToken } from '@prisma/client';

export class GoogleConnectTokenRepository {
  /**
   * Create a new connect token
   */
  async create(data: {
    outletId: string;
    token: string;
    expiresAt: Date;
  }): Promise<GoogleConnectToken> {
    return prisma.googleConnectToken.create({
      data
    });
  }

  /**
   * Find token by token string
   */
  async findByToken(token: string): Promise<GoogleConnectToken | null> {
    return prisma.googleConnectToken.findUnique({
      where: { token },
      include: { outlet: true }
    });
  }

  /**
   * Find tokens by outlet ID
   */
  async findByOutletId(outletId: string): Promise<GoogleConnectToken[]> {
    return prisma.googleConnectToken.findMany({
      where: { outletId },
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Mark token as used
   */
  async markAsUsed(token: string): Promise<GoogleConnectToken | null> {
    return prisma.googleConnectToken.update({
      where: { token },
      data: { usedAt: new Date() }
    });
  }

  /**
   * Delete expired tokens
   */
  async deleteExpired(): Promise<number> {
    const result = await prisma.googleConnectToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        usedAt: null
      }
    });
    return result.count;
  }

  /**
   * Clean up old used tokens (older than 30 days)
   */
  async cleanupOldTokens(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.googleConnectToken.deleteMany({
      where: {
        usedAt: { lt: thirtyDaysAgo }
      }
    });
    return result.count;
  }
}

export const googleConnectTokenRepository = new GoogleConnectTokenRepository();