import { Request, Response, NextFunction } from 'express';
import { ipAllowlistRepository } from '../repository/ip-allowlist.repo';
import { logger } from '../utils/logger';

const FALLBACK_IPS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  ...(process.env.ALLOWED_IPS?.split(',').map(s => s.trim()) || [])
]);

export async function checkIpAllowlist(req: Request, res: Response, next: NextFunction) {
  try {
    const clientIp = getClientIp(req);

    // Always allow localhost / dev
    if (FALLBACK_IPS.has(clientIp)) {
      return next();
    }

    const allowed = await ipAllowlistRepository.isAllowed(clientIp);

    if (!allowed) {
      logger.warn(`Access denied from IP ${clientIp}`, {
        path: req.originalUrl,
        method: req.method,
      });

      return res.status(403).json({
        error: 'Forbidden: IP not whitelisted',
        ip: clientIp,
      });
    }

    next();
  } catch (err) {
    logger.error('IP allowlist middleware error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0];
  }

  const raw = req.socket.remoteAddress || 'unknown';

  return raw.replace('::ffff:', '');
}
