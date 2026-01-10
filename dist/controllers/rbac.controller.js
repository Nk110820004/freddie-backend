"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rbacController = void 0;
const database_1 = require("../database");
const logger_1 = require("../utils/logger");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
class RBACController {
    // GET ALL ADMINS
    async getAdminUsers(_req, res) {
        try {
            const users = await database_1.prisma.user.findMany({
                where: {
                    deletedAt: null,
                },
                include: {
                    outlets: true,
                },
            });
            res.json(users);
        }
        catch (err) {
            logger_1.logger.error("Error fetching admin users", err);
            res.status(500).json({ message: "Failed to fetch users" });
        }
    }
    // UPDATE USER ROLE
    async updateUserRole(req, res) {
        try {
            const { userId, role } = req.body;
            if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
                return res.status(400).json({ message: "Invalid role" });
            }
            const user = await database_1.prisma.user.update({
                where: { id: userId },
                data: { role },
            });
            res.json({
                message: "Role updated successfully",
                user,
            });
        }
        catch (err) {
            logger_1.logger.error("Failed to update user role", err);
            res.status(500).json({ message: "Failed to update user role" });
        }
    }
    async inviteUser(req, res) {
        try {
            const { email, role } = req.body;
            if (!email || !role) {
                return res.status(400).json({ message: "Email and role are required" });
            }
            if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
                return res.status(400).json({ message: "Invalid role" });
            }
            // Check if user already exists
            const existingUser = await database_1.prisma.user.findUnique({
                where: { email },
            });
            if (existingUser) {
                return res.status(409).json({ message: "User already exists" });
            }
            // Create temporary password for new user
            const tempPassword = Math.random().toString(36).slice(-12);
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 10);
            const newUser = await database_1.prisma.user.create({
                data: {
                    name: email.split("@")[0],
                    email,
                    role,
                    passwordHash,
                },
            });
            // In production, send invitation email with temp password
            logger_1.logger.info(`User invited: ${email} with role ${role}`);
            res.status(201).json({
                message: "Invitation sent successfully",
                user: {
                    id: newUser.id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role,
                },
            });
        }
        catch (err) {
            logger_1.logger.error("Failed to invite user", err);
            res.status(500).json({ message: "Failed to invite user" });
        }
    }
    // TOGGLE 2FA
    async toggleTwoFA(req, res) {
        try {
            const { userId, enabled } = req.body;
            const user = await database_1.prisma.user.update({
                where: { id: userId },
                data: {
                    twoFactorEnabled: enabled,
                    twoFactorVerified: enabled,
                },
            });
            res.json({
                message: "2FA status updated",
                user,
            });
        }
        catch (err) {
            logger_1.logger.error("2FA toggle failed", err);
            res.status(500).json({ message: "Failed to toggle 2FA" });
        }
    }
    // DELETE USER
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            await database_1.prisma.user.update({
                where: { id },
                data: {
                    deletedAt: new Date(),
                },
            });
            res.json({ message: "User deleted" });
        }
        catch (err) {
            logger_1.logger.error("Delete user failed", err);
            res.status(500).json({ message: "Failed to delete user" });
        }
    }
    async getRoles(req, res) {
        try {
            // Since roles are an enum in Prisma, we return the supported set
            const roles = [
                { id: "SUPER_ADMIN", name: "Super Administrator", description: "Full system access" },
                { id: "ADMIN", name: "Administrator", description: "Manage outlets and users" },
            ];
            res.status(200).json(roles);
        }
        catch (error) {
            logger_1.logger.error("Failed to get roles", error);
            res.status(500).json({ error: "Failed to retrieve roles" });
        }
    }
    async assignRole(req, res) {
        try {
            const { userId } = req.params;
            const { role } = req.body;
            if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
                res.status(400).json({ error: "Invalid role" });
                return;
            }
            const user = await database_1.prisma.user.update({
                where: { id: userId },
                data: { role },
            });
            logger_1.logger.info(`Role ${role} assigned to user ${userId}`);
            res.status(200).json({ message: "Role assigned successfully", user: { id: user.id, role: user.role } });
        }
        catch (error) {
            logger_1.logger.error("Failed to assign role", error);
            res.status(500).json({ error: "Failed to assign role" });
        }
    }
}
exports.rbacController = new RBACController();
//# sourceMappingURL=rbac.controller.js.map