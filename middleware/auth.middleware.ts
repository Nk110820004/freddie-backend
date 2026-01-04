/// <reference types="node" />

import type { Request, Response, NextFunction } from "express"
import jwt, { type JwtPayload } from "jsonwebtoken"
import { refreshTokensRepository } from "../repository/refreshTokens.repo"
import { hashToken } from "../utils/token.util"
import { logger } from "../utils/logger"

export interface AuthRequest extends Request {
  userId?: string
  userRole?: "SUPER_ADMIN" | "ADMIN" | "USER"
  userEmail?: string
}

if (!process.env.JWT_ACCESS_SECRET) {
  throw new Error("JWT_ACCESS_SECRET must be set in environment variables")
}

const JWT_SECRET = process.env.JWT_ACCESS_SECRET as string

interface AuthTokenPayload extends JwtPayload {
  userId: string
  role: "SUPER_ADMIN" | "ADMIN" | "USER"
  email: string
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined

    // Check httpOnly cookie
    const cookies = req.headers.cookie?.split("; ")
    if (cookies) {
      const authCookie = cookies.find((c) => c.startsWith("auth_token="))
      if (authCookie) {
        token = authCookie.substring("auth_token=".length)
      }
    }

    // Fall back to Authorization header
    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7)
      }
    }

    if (!token) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Missing or invalid authentication token",
      })
      return
    }

    let payload: AuthTokenPayload

    try {
      payload = jwt.verify(token, JWT_SECRET) as AuthTokenPayload
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ error: "Unauthorized", message: "Token expired" })
        return
      }

      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ error: "Unauthorized", message: "Invalid token" })
        return
      }

      throw error
    }

    if (!payload.userId || !payload.role || !payload.email) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid token payload",
      })
      return
    }

    // attach to request
    req.userId = payload.userId
    req.userRole = payload.role
    req.userEmail = payload.email

    // prevent access if user has been soft-deleted
    // Note: usersRepository.getUserById already checks deletedAt; we avoid circular import here
    // but we can optionally check refresh token revocation based on cookie
    const refreshCookie = req.headers.cookie?.split('; ').find(c => c.startsWith('refresh_token='))
    if (refreshCookie) {
      const refreshPlain = refreshCookie.substring('refresh_token='.length)
      const hashed = hashToken(refreshPlain)
      // if refresh token is missing in DB -> revoke access
      const db = await refreshTokensRepository.findByHash(hashed)
      if (!db) {
        res.status(401).json({ error: 'Unauthorized', message: 'Refresh token revoked' })
        return
      }
    }

    next()
  } catch (error) {
    logger.error("Authentication middleware error", error)
    res.status(500).json({
      error: "Internal server error",
    })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.userRole === "ADMIN" || req.userRole === "SUPER_ADMIN") {
      next()
    } else {
      res.status(403).json({
        error: "Forbidden",
        message: "Insufficient permissions",
      })
    }
  })
}
