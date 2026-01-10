"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminUserController = exports.AdminUserController = void 0;
const zod_1 = require("zod");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
const users_repo_1 = require("../repository/users.repo");
const audit_repo_1 = require("../repository/audit.repo");
const email_service_1 = require("../services/email.service");
const logger_1 = require("../utils/logger");
const AdminCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    role: zod_1.z.enum(["ADMIN", "SUPER_ADMIN"]),
    phoneNumber: zod_1.z.string().optional(),
    googleEmail: zod_1.z.string().email().optional()
});
function requireSuperAdmin(req) {
    const actor = req.user;
    if (!actor || actor.role !== "SUPER_ADMIN") {
        const err = new Error("SUPER_ADMIN role required");
        err.status = 403;
        throw err;
    }
    return actor;
}
class AdminUserController {
    async create(req, res) {
        try {
            const actor = requireSuperAdmin(req);
            const input = AdminCreateSchema.parse(req.body);
            // Only super admin can create super admin
            if (input.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") {
                return res.status(403).json({ error: "Only SUPER_ADMIN may create SUPER_ADMIN" });
            }
            const existing = await users_repo_1.usersRepository.getUserByEmail(input.email.toLowerCase());
            if (existing)
                return res.status(409).json({ error: "User already exists" });
            // cryptographically strong temporary password
            const tempPassword = crypto_1.default.randomBytes(12).toString("base64url");
            const passwordHash = await bcryptjs_1.default.hash(tempPassword, 12);
            const user = await users_repo_1.usersRepository.createUser({
                name: input.name,
                email: input.email.toLowerCase(),
                role: input.role,
                passwordHash,
                whatsappNumber: input.phoneNumber,
                googleEmail: input.googleEmail
            });
            await audit_repo_1.auditRepository.createAuditLog({
                action: "ADMIN_USER_CREATED",
                entity: "User",
                entityId: user.id,
                userId: actor.id,
                details: { role: input.role }
            });
            await email_service_1.emailService.sendOnboardingEmail(input.email, input.name, tempPassword).catch(() => logger_1.logger.warn("Failed to send onboarding email"));
            res.status(201).json({
                message: "Admin user created",
                user: { id: user.id, name: user.name, email: user.email, role: user.role }
            });
        }
        catch (err) {
            logger_1.logger.error("Admin user create failed", err);
            res.status(err.status || 500).json({ error: err.message || "Failed" });
        }
    }
    async getUsers(req, res) {
        try {
            const users = await users_repo_1.usersRepository.getAll();
            res.json(users);
        }
        catch (err) {
            logger_1.logger.error("Get users failed", err);
            res.status(500).json({ error: "Failed to get users" });
        }
    }
    async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { name, email, role } = req.body;
            const updated = await users_repo_1.usersRepository.updateUser(id, { name, email, role });
            res.json(updated);
        }
        catch (err) {
            logger_1.logger.error("Update user failed", err);
            res.status(500).json({ error: "Failed to update user" });
        }
    }
    async deleteUser(req, res) {
        try {
            const { id } = req.params;
            await users_repo_1.usersRepository.delete(id);
            res.json({ message: "User deleted" });
        }
        catch (err) {
            logger_1.logger.error("Delete user failed", err);
            res.status(500).json({ error: "Failed to delete user" });
        }
    }
}
exports.AdminUserController = AdminUserController;
exports.adminUserController = new AdminUserController();
//# sourceMappingURL=adminUser.controller.js.map