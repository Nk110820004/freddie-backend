import { prisma } from '../database';
import { IpAllowlist, ApiKey } from '@prisma/client';

export class SecurityRepository {
  // ---- IP ALLOWLIST ----
  async getAllowlist(): Promise<IpAllowlist[]> {
    return prisma.ipAllowlist.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async addIP(ip: string, description?: string): Promise<IpAllowlist> {
    return prisma.ipAllowlist.create({
      data: {
        ip,
        description: description || null,
      },
    });
  }

  async removeIP(id: string): Promise<IpAllowlist> {
    return prisma.ipAllowlist.delete({
      where: { id },
    });
  }

  async toggleIP(id: string, isActive: boolean): Promise<IpAllowlist> {
    return prisma.ipAllowlist.update({
      where: { id },
      data: { isActive },
    });
  }

  // ---- API KEYS ----
  async getActiveApiKeys(): Promise<ApiKey[]> {
    return prisma.apiKey.findMany({
      where: { isActive: true },
    });
  }
}

export const securityRepository = new SecurityRepository();
