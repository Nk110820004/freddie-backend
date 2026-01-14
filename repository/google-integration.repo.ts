import { prisma } from '../database';
import { GoogleIntegration } from '@prisma/client';

export class GoogleIntegrationRepository {
  /**
   * Create a new Google integration for an outlet
   */
  async create(data: {
    outletId: string;
    googleEmail: string;
    refreshToken: string;
  }): Promise<GoogleIntegration> {
    return prisma.googleIntegration.create({
      data
    });
  }

  /**
   * Find integration by outlet ID
   */
  async findByOutletId(outletId: string): Promise<GoogleIntegration | null> {
    return prisma.googleIntegration.findUnique({
      where: { outletId }
    });
  }

  /**
   * Update refresh token for an outlet
   */
  async updateRefreshToken(outletId: string, refreshToken: string): Promise<GoogleIntegration | null> {
    return prisma.googleIntegration.update({
      where: { outletId },
      data: { refreshToken }
    });
  }

  /**
   * Delete integration for an outlet
   */
  async deleteByOutletId(outletId: string): Promise<GoogleIntegration | null> {
    try {
      return await prisma.googleIntegration.delete({
        where: { outletId }
      });
    } catch {
      return null;
    }
  }

  /**
   * Get all integrations
   */
  async getAll(): Promise<GoogleIntegration[]> {
    return prisma.googleIntegration.findMany({
      include: { outlet: true },
      orderBy: { connectedAt: 'desc' }
    });
  }
}

export const googleIntegrationRepository = new GoogleIntegrationRepository();