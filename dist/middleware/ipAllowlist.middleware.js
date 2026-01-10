"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIpAllowlist = checkIpAllowlist;
const ip_allowlist_repo_1 = require("../repository/ip-allowlist.repo");
const logger_1 = require("../utils/logger");
const net = __importStar(require("net"));
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const FALLBACK_IPS = new Set([
    "127.0.0.1",
    "::1",
    ...(process.env.ALLOWED_IPS?.split(",").map(s => s.trim()) ?? [])
]);
async function checkIpAllowlist(req, res, next) {
    try {
        const clientIp = getClientIp(req);
        // Always allow dev/local
        if (FALLBACK_IPS.has(clientIp)) {
            return next();
        }
        // DB-based allowlist
        const allowed = await ip_allowlist_repo_1.ipAllowlistRepository.isAllowed(clientIp);
        if (!allowed) {
            logger_1.logger.warn(`Access denied from IP ${clientIp}`, {
                path: req.originalUrl,
                method: req.method
            });
            return res.status(403).json({
                error: "Forbidden: IP not whitelisted",
                ip: clientIp
            });
        }
        next();
    }
    catch (err) {
        logger_1.logger.error("IP allowlist middleware error", err);
        res.status(500).json({ error: "Internal server error" });
    }
}
function getClientIp(req) {
    let ip;
    if (TRUST_PROXY) {
        const forwarded = req.headers["x-forwarded-for"];
        if (typeof forwarded === "string") {
            ip = forwarded.split(",")[0].trim();
        }
        else if (Array.isArray(forwarded)) {
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
//# sourceMappingURL=ipAllowlist.middleware.js.map