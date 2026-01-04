import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import env from '../config/env'

export function generateRandomToken(size = 48) {
  return crypto.randomBytes(size).toString('hex')
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function signAccessToken(payload: object) {
  const secret = (process.env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET) as unknown as jwt.Secret
  const expiresIn = (process.env.JWT_ACCESS_EXPIRY || env.JWT_ACCESS_EXPIRY) as unknown as any
  return jwt.sign(payload as any, secret, { expiresIn } as any)
}

export function verifyAccessToken(token: string) {
  const secret = process.env.JWT_ACCESS_SECRET || env.JWT_ACCESS_SECRET
  return jwt.verify(token, secret)
}
