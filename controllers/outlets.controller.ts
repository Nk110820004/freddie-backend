import { Request, Response } from 'express';

import { outletsRepository } from '../repository/outlets.repo';
import { reviewsRepository } from '../repository/reviews.repo';
import { billingRepository } from '../repository/billing.repo';
import { auditRepository } from '../repository/audit.repo';

import { logger } from '../utils/logger';

export interface CreateOutletRequest {
  name: string;
  userId: string;
}

export interface UpdateOutletRequest {
  name?: string;
  status?: 'ACTIVE' | 'PAUSED' | 'DISABLED';
}

export class OutletsController {
  /**
   * GET all outlets
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const outlets = await outletsRepository.getAllOutlets();

      res.status(200).json(outlets);
    } catch (err) {
      logger.error('Failed to get outlets', err);
      res.status(500).json({ error: 'Failed to retrieve outlets' });
    }
  }

  /**
   * GET outlet by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const outlet = await outletsRepository.getOutletById(id);

      if (!outlet) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      res.status(200).json(outlet);
    } catch (err) {
      logger.error('Failed to get outlet', err);
      res.status(500).json({ error: 'Failed to retrieve outlet' });
    }
  }

  /**
   * CREATE outlet
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const actorId = (req as any).userId;

      const { name, userId } = req.body as CreateOutletRequest;

      if (!name || !userId) {
        res.status(400).json({
          error: 'Name and User ID are required',
        });
        return;
      }

      // create outlet
      const outlet = await outletsRepository.createOutlet({
        name,
        userId,
      });

      // create billing record
      await billingRepository.createBilling({
        outletId: outlet.id,
        plan: 'TRIAL',
      });

      // audit log
      await auditRepository.createAuditLog({
        action: 'OUTLET_CREATED',
        entity: 'Outlet',
        entityId: outlet.id,
        userId: actorId,
        details: { name },
      });

      res.status(201).json({
        message: 'Outlet created successfully',
        outlet,
      });
    } catch (err) {
      logger.error('Failed to create outlet', err);
      res.status(500).json({ error: 'Failed to create outlet' });
    }
  }

  /**
   * UPDATE outlet
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const actorId = (req as any).userId;

      const data = req.body as UpdateOutletRequest;

      const outlet = await outletsRepository.getOutletById(id);

      if (!outlet) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      const updated = await outletsRepository.updateOutlet(id, {
        ...data,
      });

      await auditRepository.createAuditLog({
        action: 'OUTLET_UPDATED',
        entity: 'Outlet',
        entityId: id,
        userId: actorId,
        details: data,
      });

      res.status(200).json({
        message: 'Outlet updated successfully',
        outlet: updated,
      });
    } catch (err) {
      logger.error('Failed to update outlet', err);
      res.status(500).json({ error: 'Failed to update outlet' });
    }
  }

  /**
   * DELETE outlet
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const actorId = (req as any).userId;

      const outlet = await outletsRepository.getOutletById(id);

      if (!outlet) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      // ⚠️ cascade already handled by DB, but we also ensure cleanup
      await reviewsRepository.deleteReview(id).catch(() => null);

      await outletsRepository.deleteOutlet(id);

      await auditRepository.createAuditLog({
        action: 'OUTLET_DELETED',
        entity: 'Outlet',
        entityId: id,
        userId: actorId,
        details: { name: outlet.name },
      });

      res.status(200).json({
        message: 'Outlet deleted successfully',
      });
    } catch (err) {
      logger.error('Failed to delete outlet', err);
      res.status(500).json({ error: 'Failed to delete outlet' });
    }
  }

  /**
   * Outlet health
   */
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await outletsRepository.getOutletHealthMetrics(id);

      if (!result) {
        res.status(404).json({ error: 'Outlet not found' });
        return;
      }

      res.status(200).json(result);
    } catch (err) {
      logger.error('Failed to fetch outlet health', err);
      res.status(500).json({ error: 'Failed to retrieve outlet health' });
    }
  }

  /**
   * Get outlet reviews (paginated)
   */
  async getReviews(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { limit = '50', offset = '0' } = req.query;

      const parsedLimit = Math.min(parseInt(limit as string) || 50, 500);
      const parsedOffset = parseInt(offset as string) || 0;

      const reviews = await reviewsRepository.getReviewsByOutlet(
        id,
        parsedLimit,
        parsedOffset
      );

      res.status(200).json({
        data: reviews,
        limit: parsedLimit,
        offset: parsedOffset,
      });
    } catch (err) {
      logger.error('Failed to fetch outlet reviews', err);
      res.status(500).json({ error: 'Failed to retrieve outlet reviews' });
    }
  }
}

export const outletsController = new OutletsController();
