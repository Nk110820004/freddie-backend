import { Request, Response } from 'express';

import { ipAllowlistRepository } from '../repository/ip-allowlist.repo';
import { apiKeyRepository } from '../repository/api-key.repo';
import { outletsRepository } from '../repository/outlets.repo';
import { auditRepository } from '../repository/audit.repo';

import { apiKeyService } from '../services/apikey.service';
import { logger } from '../utils/logger';

export interface AddIPRequest {
  ip: string;
  description?: string;
}

export interface CreateAPIKeyRequest {
  outletId: string;
  description?: string;
}

export class SecurityController {
  /**
   * IP ALLOWLIST
   */

  async getIPAllowlist(req: Request, res: Response): Promise<void> {
    try {
      const ips = await ipAllowlistRepository.getAll();
      res.status(200).json(ips);
    } catch (error) {
      logger.error('Failed to get IP allowlist', error);
      res.status(500).json({ error: 'Failed to retrieve IP allowlist' });
    }
  }

  async addIP(req: Request, res: Response): Promise<void> {
    try {
      const { ip, description } = req.body as AddIPRequest;
      const actorId = (req as any).userId;

      if (!ip) {
        res.status(400).json({ error: 'IP address is required' });
        return;
      }

      const ipRegex =
        /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;

      if (!ipRegex.test(ip)) {
        res.status(400).json({ error: 'Invalid IP address format' });
        return;
      }

      const exists = await ipAllowlistRepository.getByIP(ip);
      if (exists) {
        res.status(409).json({ error: 'IP already in allowlist' });
        return;
      }

      const entry = await ipAllowlistRepository.create(ip, description);

      await auditRepository.createAuditLog({
        action: 'IP_ALLOWLIST_ADDED',
        entity: 'IpAllowlist',
        entityId: entry.id,
        userId: actorId,
        details: { ip },
      });

      res.status(201).json({
        message: 'IP added to allowlist',
        data: entry,
      });
    } catch (error) {
      logger.error('Failed to add IP', error);
      res.status(500).json({ error: 'Failed to add IP to allowlist' });
    }
  }

  async removeIP(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const actorId = (req as any).userId;

      const entry = await ipAllowlistRepository.getById(id);
      if (!entry) {
        res.status(404).json({ error: 'IP not found' });
        return;
      }

      await ipAllowlistRepository.delete(id);

      await auditRepository.createAuditLog({
        action: 'IP_ALLOWLIST_REMOVED',
        entity: 'IpAllowlist',
        entityId: id,
        userId: actorId,
        details: { ip: entry.ip },
      });

      res.status(200).json({ message: 'IP removed from allowlist' });
    } catch (error) {
      logger.error('Failed to remove IP', error);
      res.status(500).json({ error: 'Failed to remove IP from allowlist' });
    }
  }

  async toggleIP(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const actorId = (req as any).userId;

      const entry = await ipAllowlistRepository.getById(id);
      if (!entry) {
        res.status(404).json({ error: 'IP not found' });
        return;
      }

      const updated = await ipAllowlistRepository.setStatus(id, isActive);

      await auditRepository.createAuditLog({
        action: 'IP_ALLOWLIST_TOGGLED',
        entity: 'IpAllowlist',
        entityId: id,
        userId: actorId,
        details: { ip: entry.ip, isActive },
      });

      res.status(200).json({
        message: 'IP status updated',
        data: updated,
      });
    } catch (error) {
      logger.error('Failed to toggle IP', error);
      res.status(500).json({ error: 'Failed to update IP status' });
    }
  }

  /**
   * API KEYS
   */

  async getAPIKeys(req: Request, res: Response): Promise<void> {
    try {
      const keys = await apiKeyRepository.getActiveKeys();

      const safeKeys = keys.map((k) => ({
        ...k,
        keyHash: `****${k.keyHash.slice(-6)}`, // never expose full hash
      }));

      res.status(200).json(safeKeys);
    } catch (error) {
      logger.error('Failed to get API keys', error);
      res.status(500).json({ error: 'Failed to retrieve API keys' });
    }
  }

  async createAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { outletId } = req.body as CreateAPIKeyRequest;
      const actorId = (req as any).userId;

      if (!outletId) {
        res.status(400).json({ error: 'Outlet ID is required' });
        return;
      }

      const outlet = await outletsRepository.getOutletById(outletId);
      if (!outlet) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      const { key, keyHash, expiresAt } = apiKeyService.generateKey();

      const apiKey = await apiKeyRepository.create({
        keyHash,
        expiresAt,
        outletId,
        userId: actorId,
      });

      await auditRepository.createAuditLog({
        action: 'API_KEY_GENERATED',
        entity: 'ApiKey',
        entityId: apiKey.id,
        userId: actorId,
        details: { outletId },
      });

      res.status(201).json({
        message: 'API key created successfully',
        key,
        keyId: apiKey.id,
        expiresAt,
        warning:
          'Store this key securely. It will not be shown again.',
      });
    } catch (error) {
      logger.error('Failed to create API key', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }

  async revokeAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const actorId = (req as any).userId;

      const key = await apiKeyRepository.getById(id);
      if (!key) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      await apiKeyRepository.revoke(id);

      await auditRepository.createAuditLog({
        action: 'API_KEY_REVOKED',
        entity: 'ApiKey',
        entityId: id,
        userId: actorId,
      });

      res.status(200).json({ message: 'API key revoked successfully' });
    } catch (error) {
      logger.error('Failed to revoke API key', error);
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  }

  async rotateAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const actorId = (req as any).userId;

      const key = await apiKeyRepository.getById(id);
      if (!key) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      const { key: newKey, keyHash, expiresAt } = apiKeyService.generateKey();

      await apiKeyRepository.rotate(id, keyHash, expiresAt);

      await auditRepository.createAuditLog({
        action: 'API_KEY_ROTATED',
        entity: 'ApiKey',
        entityId: id,
        userId: actorId,
      });

      res.status(200).json({
        message: 'API key rotated successfully',
        key: newKey,
        expiresAt,
        warning: 'Store this key securely. It will not be shown again.',
      });
    } catch (error) {
      logger.error('Failed to rotate API key', error);
      res.status(500).json({ error: 'Failed to rotate API key' });
    }
  }

  async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const [ips, apiKeys] = await Promise.all([
        ipAllowlistRepository.getAll(),
        apiKeyRepository.getActiveKeys(),
      ]);

      res.status(200).json({
        ipAllowlist: ips,
        apiKeys: apiKeys.map(k => ({
          ...k,
          keyHash: `****${k.keyHash.slice(-6)}`,
        })),
      });
    } catch (error) {
      logger.error('Failed to get security settings', error);
      res.status(500).json({ error: 'Failed to retrieve security settings' });
    }
  }
}

export const securityController = new SecurityController();
