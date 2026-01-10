import { prisma } from '../database';
import { IpAllowlist } from '@prisma/client';

export class IpAllowlistRepository {
    async isAllowed(ip: string): Promise<boolean> {
  const entry = await prisma.ipAllowlist.findFirst({
    where: {
      ip,
      isActive: true,
    },
  });

  return !!entry;
}

  async getAll(): Promise<IpAllowlist[]> {
    return prisma.ipAllowlist.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getById(id: string): Promise<IpAllowlist | null> {
    return prisma.ipAllowlist.findUnique({ where: { id } });
  }

  async getByIP(ip: string): Promise<IpAllowlist | null> {
    return prisma.ipAllowlist.findUnique({ where: { ip } });
  }

  async create(ip: string, description?: string): Promise<IpAllowlist> {
    return prisma.ipAllowlist.create({
      data: {
        ip,
        description: description || null,
      },
    });
  }

  async delete(id: string): Promise<IpAllowlist> {
    return prisma.ipAllowlist.delete({ where: { id } });
  }

  async setStatus(id: string, isActive: boolean): Promise<IpAllowlist> {
    return prisma.ipAllowlist.update({
      where: { id },
      data: { isActive },
    });
  }
}



export const ipAllowlistRepository = new IpAllowlistRepository();
