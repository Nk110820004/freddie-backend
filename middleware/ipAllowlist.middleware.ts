import { Request, Response, NextFunction } from "express";
import { ipAllowlistRepository } from "../repository/ip-allowlist.repo";
import { logger } from "../utils/logger";
import * as net from "net";

const TRUST_PROXY = process.env.TRUST_PROXY === "true";

const FALLBACK_IPS = new Set([
  "127.0.0.1",
  "::1",
  ...(process.env.ALLOWED_IPS?.split(",").map(s => s.trim()) ?? [])
]);

export async function checkIpAllowlist(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const clientIp = getClientIp(req);

    // Always allow dev/local
    if (FALLBACK_IPS.has(clientIp)) {
      return next();
    }

    // DB-based allowlist
    const allowed = await ipAllowlistRepository.isAllowed(clientIp);

    if (!allowed) {
      logger.warn(`Access denied from IP ${clientIp}`, {
        path: req.originalUrl,
        method: req.method
      });

      return res.status(403).json({
        error: "Forbidden: IP not whitelisted",
        ip: clientIp
      });
    }

    next();
  } catch (err) {
    logger.error("IP allowlist middleware error", err);
    res.status(500).json({ error: "Internal server error" });
  }
}

function getClientIp(req: Request): string {
  let ip: string | undefined;

  if (TRUST_PROXY) {
    const forwarded = req.headers["x-forwarded-for"];

    if (typeof forwarded === "string") {
      ip = forwarded.split(",")[0].trim();
    } else if (Array.isArray(forwarded)) {
      ip = forwarded[0];
    }
  }

  if (!ip) {
    ip = req.socket.remoteAddress ?? "unknown";
  }

  // normalize IPv6 to standard format
  ip = ip.replace("::ffff:", "");

  // for IPv6 zones (rare cases)
  ip = ip.split("%")[0];

  if (!net.isIP(ip)) {
    return "unknown";
  }

  return ip;
}
