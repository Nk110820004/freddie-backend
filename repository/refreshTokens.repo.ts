import { prisma } from '../database'

export interface RefreshTokenRecord {
  id: string
  tokenHash: string
  userId: string
  expiresAt: Date
  createdAt: Date
}

export class RefreshTokensRepository {
  async create(tokenHash: string, userId: string, expiresAt: Date) {
    return prisma.refreshToken.create({
      data: {
        tokenHash,
        userId,
        expiresAt,
      },
    })
  }

  async findByHash(tokenHash: string) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } })
  }

  async deleteByHash(tokenHash: string) {
    return prisma.refreshToken.deleteMany({ where: { tokenHash } })
  }

  async deleteByUserId(userId: string) {
    return prisma.refreshToken.deleteMany({ where: { userId } })
  }

  async pruneExpired() {
    return prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  }
}

export const refreshTokensRepository = new RefreshTokensRepository()
