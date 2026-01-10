"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingRepository = exports.BillingRepository = void 0;
const database_1 = require("../database");
class BillingRepository {
    async getBillingByOutletId(outletId) {
        return database_1.prisma.billing.findUnique({
            where: { outletId },
        });
    }
    async createBilling(data) {
        const TRIAL_DAYS = 30;
        const trialEndsAt = data.trialEndsAt ?? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        return database_1.prisma.billing.create({
            data: {
                outletId: data.outletId,
                status: data.status ?? "TRIAL",
                trialEndsAt,
            },
        });
    }
    async updateSubscriptionStatus(outletId, status) {
        return database_1.prisma.billing.update({
            where: { outletId },
            data: {
                status,
                updatedAt: new Date(),
            },
        });
    }
    async updatePaidUntil(outletId, paidUntil) {
        return database_1.prisma.billing.update({
            where: { outletId },
            data: {
                paidUntil,
                status: "ACTIVE",
                updatedAt: new Date(),
            },
        });
    }
    async deactivateBilling(outletId) {
        return database_1.prisma.billing.update({
            where: { outletId },
            data: {
                status: "INACTIVE",
                updatedAt: new Date(),
            },
        });
    }
    async activateBilling(outletId) {
        return database_1.prisma.billing.update({
            where: { outletId },
            data: {
                status: "ACTIVE",
                updatedAt: new Date(),
            },
        });
    }
    async getActivePaidSubscriptions() {
        return database_1.prisma.billing.findMany({
            where: {
                status: "ACTIVE",
            },
            include: {
                outlet: true,
            },
        });
    }
    async getExpiringTrials(daysBeforeExpiry = 3) {
        const now = new Date();
        const threshold = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000);
        return database_1.prisma.billing.findMany({
            where: {
                status: "TRIAL",
                trialEndsAt: {
                    lte: threshold,
                    gt: now,
                },
            },
            include: {
                outlet: true,
            },
        });
    }
    async getOverdueBillings() {
        return database_1.prisma.billing.findMany({
            where: {
                paidUntil: { lt: new Date() },
                status: "ACTIVE",
            },
            include: {
                outlet: true,
            },
        });
    }
    async enforceBillingRules(outletId) {
        const billing = await this.getBillingByOutletId(outletId);
        if (!billing)
            return;
        const now = new Date();
        if (billing.status === "TRIAL" && billing.trialEndsAt && billing.trialEndsAt < now) {
            await this.updateSubscriptionStatus(outletId, "INACTIVE");
            return;
        }
        if (billing.status === "ACTIVE" && billing.paidUntil && billing.paidUntil < now) {
            await this.updateSubscriptionStatus(outletId, "PAST_DUE");
            return;
        }
    }
    async getBillingStats() {
        const billings = await database_1.prisma.billing.findMany({
            include: {
                outlet: {
                    include: {
                        reviews: true,
                    },
                },
            },
        });
        const total = billings.length;
        const activePaid = billings.filter((b) => b.status === "ACTIVE").length;
        const trials = billings.filter((b) => b.status === "TRIAL").length;
        const inactive = billings.filter((b) => b.status === "INACTIVE").length;
        const totalReviews = billings.reduce((sum, b) => sum + b.outlet.reviews.length, 0);
        const MONTHLY_PRICE = 29;
        const monthlyRecurringRevenue = billings
            .filter((b) => b.status === "ACTIVE")
            .reduce((sum) => sum + MONTHLY_PRICE, 0);
        return {
            total,
            activePaid,
            trials,
            inactive,
            totalReviews,
            monthlyRecurringRevenue,
        };
    }
    async deleteBilling(outletId) {
        return database_1.prisma.billing.delete({
            where: { outletId },
        });
    }
}
exports.BillingRepository = BillingRepository;
exports.billingRepository = new BillingRepository();
//# sourceMappingURL=billing.repo.js.map