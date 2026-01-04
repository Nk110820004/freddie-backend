import { Request, Response } from "express";
import { auditRepository } from "../repository/audit.repo";
import { logger } from "../utils/logger";

export class AuditController {
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { limit = "50" } = req.query;

      const logs = await auditRepository.getRecentAuditLogs(
        parseInt(limit as string, 10)
      );

      res.status(200).json(logs);
    } catch (error) {
      logger.error("Failed to fetch audit logs", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  }

  async byUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const logs = await auditRepository.getAuditLogsForUser(userId);

      res.status(200).json(logs);
    } catch (error) {
      logger.error("Failed to fetch user audit logs", error);
      res.status(500).json({ error: "Failed to fetch user logs" });
    }
  }

  async sensitive(req: Request, res: Response): Promise<void> {
    try {
      const logs = await auditRepository.getSensitiveActions();

      res.status(200).json(logs);
    } catch (error) {
      logger.error("Failed to fetch sensitive logs", error);
      res.status(500).json({ error: "Failed to fetch sensitive logs" });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await auditRepository.deleteOldAuditLogs();

      res.status(200).json({ message: "Audit log deleted" });
    } catch (error) {
      logger.error("Failed to delete audit log", error);
      res.status(500).json({ error: "Failed to delete log" });
    }
  }
}

export const auditController = new AuditController();
