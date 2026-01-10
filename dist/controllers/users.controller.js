"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersController = exports.UsersController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const users_repo_1 = require("../repository/users.repo");
const audit_repo_1 = require("../repository/audit.repo");
const logger_1 = require("../utils/logger");
const client_1 = require("@prisma/client");
//
// ---------- PASSWORD POLICY UTILITY (no controller cross-dependency)
//
function validatePasswordStrength(password) {
    const errors = [];
    if (password.length < 8)
        errors.push("Minimum 8 characters");
    if (!/[A-Z]/.test(password))
        errors.push("Must include uppercase letter");
    if (!/[a-z]/.test(password))
        errors.push("Must include lowercase letter");
    if (!/[0-9]/.test(password))
        errors.push("Must include number");
    if (!/[!@#$%^&*(),.?\":{}|<>]/.test(password))
        errors.push("Must include special symbol");
    return { valid: errors.length === 0, errors };
}
//
// ----------------- VALIDATION SCHEMAS -----------------
//
const CreateUserSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8),
    role: zod_1.z.nativeEnum(client_1.UserRole)
});
const UpdateProfileSchema = zod_1.z.object({
    phone: zod_1.z.string().optional(),
    googleEmail: zod_1.z.string().email().optional(),
    gmbAccountId: zod_1.z.string().optional()
});
class UsersController {
    //
    // -------- GET ALL USERS ----------
    //
    async getAll(req, res) {
        try {
            const users = await users_repo_1.usersRepository.getAll();
            res.json(users);
        }
        catch (err) {
            logger_1.logger.error("getAll failed", err);
            res.status(500).json({ error: "Failed to fetch users" });
        }
    }
    async getById(req, res) {
        try {
            const { id } = req.params;
            const user = await users_repo_1.usersRepository.getById(id);
            if (!user)
                return res.status(404).json({ error: "User not found" });
            res.json(user);
        }
        catch (err) {
            logger_1.logger.error("getById failed", err);
            res.status(500).json({ error: "Failed to fetch user" });
        }
    }
    //
    // -------- CREATE USER ----------
    //
    async create(req, res) {
        try {
            const actorId = req.userId;
            const actor = await users_repo_1.usersRepository.getUserById(actorId);
            const parsed = CreateUserSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json(parsed.error.flatten());
            }
            const { name, email, password, role } = parsed.data;
            // RBAC: only super admin can create super admin
            if (role === "SUPER_ADMIN" && actor?.role !== "SUPER_ADMIN") {
                return res.status(403).json({ error: "Insufficient permissions" });
            }
            const strength = validatePasswordStrength(password);
            if (!strength.valid) {
                return res
                    .status(400)
                    .json({ error: "Weak password", details: strength.errors });
            }
            const exists = await users_repo_1.usersRepository.getUserByEmail(email);
            if (exists && !exists.deletedAt) {
                return res.status(409).json({ error: "User already exists" });
            }
            const passwordHash = await bcryptjs_1.default.hash(password, 12);
            const user = await users_repo_1.usersRepository.createUser({
                name,
                email: email.toLowerCase(),
                passwordHash,
                role
            });
            await audit_repo_1.auditRepository.createAuditLog({
                action: "USER_CREATED",
                entity: "User",
                entityId: user.id,
                userId: actorId,
                details: { name, email, role }
            });
            res.status(201).json({
                message: "User created",
                user
            });
        }
        catch (err) {
            logger_1.logger.error("create user failed", err);
            res.status(500).json({ error: "Failed to create user" });
        }
    }
    async update(req, res) {
        try {
            const { id } = req.params;
            const data = req.body;
            const updated = await users_repo_1.usersRepository.updateUser(id, data);
            res.json(updated);
        }
        catch (err) {
            logger_1.logger.error("update user failed", err);
            res.status(500).json({ error: "Failed to update user" });
        }
    }
    //
    // -------- CHANGE PASSWORD ----------
    //
    async changePassword(req, res) {
        try {
            const userId = req.userId;
            const { currentPassword, newPassword } = req.body;
            const strength = validatePasswordStrength(newPassword);
            if (!strength.valid) {
                return res
                    .status(400)
                    .json({ error: "Weak password", details: strength.errors });
            }
            const user = await users_repo_1.usersRepository.getUserById(userId);
            if (!user)
                return res.status(404).json({ error: "User not found" });
            const ok = await bcryptjs_1.default.compare(currentPassword, user.passwordHash);
            if (!ok)
                return res.status(401).json({ error: "Invalid current password" });
            const hash = await bcryptjs_1.default.hash(newPassword, 12);
            await users_repo_1.usersRepository.updateUser(userId, {
                passwordHash: hash
            });
            await audit_repo_1.auditRepository.createAuditLog({
                action: "PASSWORD_CHANGED",
                entity: "User",
                entityId: userId,
                userId
            });
            res.json({ message: "Password changed" });
        }
        catch (err) {
            logger_1.logger.error("changePassword failed", err);
            res.status(500).json({ error: "Failed to change password" });
        }
    }
    //
    // -------- DELETE USER ----------
    //
    async delete(req, res) {
        try {
            const { id } = req.params;
            const actorId = req.userId;
            if (id === actorId)
                return res.status(400).json({ error: "Cannot delete self" });
            const user = await users_repo_1.usersRepository.getUserById(id);
            if (!user)
                return res.status(404).json({ error: "User not found" });
            // prevent deleting last super admin
            if (user.role === "SUPER_ADMIN") {
                const remaining = await users_repo_1.usersRepository.countSuperAdmins();
                if (remaining <= 1) {
                    return res
                        .status(400)
                        .json({ error: "Cannot delete last SUPER_ADMIN" });
                }
            }
            await users_repo_1.usersRepository.softDeleteUser(id);
            await audit_repo_1.auditRepository.createAuditLog({
                action: "USER_DELETED",
                entity: "User",
                entityId: id,
                userId: actorId
            });
            res.json({ message: "User deleted" });
        }
        catch (err) {
            logger_1.logger.error("delete failed", err);
            res.status(500).json({ error: "Delete failed" });
        }
    }
    async enrollTwoFA(req, res) {
        try {
            const { id } = req.params;
            // Placeholder
            res.json({ message: "2FA enrolled" });
        }
        catch (err) {
            logger_1.logger.error("enrollTwoFA failed", err);
            res.status(500).json({ error: "Failed" });
        }
    }
    async verifyTwoFAEnrollment(req, res) {
        try {
            const { id } = req.params;
            // Placeholder
            res.json({ message: "2FA verified" });
        }
        catch (err) {
            logger_1.logger.error("verifyTwoFAEnrollment failed", err);
            res.status(500).json({ error: "Failed" });
        }
    }
    async getProfile(req, res) {
        try {
            const userId = req.userId;
            const user = await users_repo_1.usersRepository.getById(userId);
            if (!user)
                return res.status(404).json({ error: "User not found" });
            res.json(user);
        }
        catch (err) {
            logger_1.logger.error("getProfile failed", err);
            res.status(500).json({ error: "Failed" });
        }
    }
    async updateProfile(req, res) {
        try {
            const userId = req.userId;
            const data = req.body;
            const updated = await users_repo_1.usersRepository.updateUser(userId, data);
            res.json(updated);
        }
        catch (err) {
            logger_1.logger.error("updateProfile failed", err);
            res.status(500).json({ error: "Failed" });
        }
    }
}
exports.UsersController = UsersController;
exports.usersController = new UsersController();
//# sourceMappingURL=users.controller.js.map