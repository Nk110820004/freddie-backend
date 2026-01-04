import type { Request, Response } from 'express'
import { hashToken, generateRandomToken } from '../utils/token.util'
import { refreshTokensRepository } from '../repository/refreshTokens.repo'
import { usersRepository } from '../repository/users.repo'
import { signAccessToken } from '../utils/token.util'
import { logger } from '../utils/logger'

export class RefreshController {
  async rotate(req: Request, res: Response): Promise<void> {
    try {
      const refreshCookie = req.cookies?.refresh_token || req.headers['x-refresh-token'] || req.body.refreshToken

      if (!refreshCookie) {
        res.status(401).json({ error: 'Missing refresh token' })
        return
      }

      const hashed = hashToken(String(refreshCookie))
      const db = await refreshTokensRepository.findByHash(hashed)

      if (!db) {
        res.status(401).json({ error: 'Invalid or revoked refresh token' })
        return
      }

      if (db.expiresAt < new Date()) {
        // remove expired
        await refreshTokensRepository.deleteByHash(hashed)
        res.status(401).json({ error: 'Refresh token expired' })
        return
      }

      const user = await usersRepository.getUserById(db.userId)
      if (!user || user.deletedAt) {
        res.status(401).json({ error: 'User not found or disabled' })
        return
      }

      // rotate refresh token: delete existing and issue new one
      await refreshTokensRepository.deleteByHash(hashed)

      const newPlain = generateRandomToken(32)
      const newHash = hashToken(newPlain)
      const expiresAtNew = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await refreshTokensRepository.create(newHash, user.id, expiresAtNew)

      const accessToken = signAccessToken({ userId: user.id, role: user.role, email: user.email })

      res.cookie('auth_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as any) || 'lax',
        maxAge: 1000 * 60 * 60,
      })

      res.cookie('refresh_token', newPlain, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: (process.env.COOKIE_SAME_SITE as any) || 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })

      res.status(200).json({ token: accessToken })
    } catch (err) {
      logger.error('Refresh rotate error', err)
      res.status(500).json({ error: 'Internal server error' })
    }
  }
}

export const refreshController = new RefreshController()
