import { db } from '../database';
import { ApiKey } from '@prisma/client';

export class ApiKeyRepository {
  async create(data: {
    keyHash: string;
    userId: string;
    outletId: string;
    expiresAt: Date;
  }): Promise<ApiKey> {
    return db.apiKey.create({
      data,
    });
  }

  async getById(id: string): Promise<ApiKey | null> {
    return db.apiKey.findUnique({
      where: { id },
    });
  }

  async getActiveKeys(): Promise<ApiKey[]> {
    return db.apiKey.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getByOutlet(outletId: string): Promise<ApiKey[]> {
    return db.apiKey.findMany({
      where: { outletId },
    });
  }

  async revoke(id: string): Promise<ApiKey> {
    return db.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async rotate(oldId: string, newKeyHash: string, expiresAt: Date): Promise<ApiKey> {
    const old = await db.apiKey.update({
      where: { id: oldId },
      data: { isActive: false },
    });

    return db.apiKey.create({
      data: {
        keyHash: newKeyHash,
        outletId: old.outletId,
        userId: old.userId,
        expiresAt,
      },
    });
  }

  async getExpiringSoon(days = 30): Promise<ApiKey[]> {
    const threshold = new Date(Date.now() + days * 86400000);

    return db.apiKey.findMany({
      where: {
        expiresAt: { lte: threshold },
        isActive: true,
      },
    });
  }
}

export const apiKeyRepository = new ApiKeyRepository();
