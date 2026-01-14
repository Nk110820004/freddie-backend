"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.outletsRepository = exports.OutletRepository = void 0;
const database_1 = require("../database");
const client_1 = require("@prisma/client");
class OutletRepository {
    //
    // ----------- READ -----------
    //
    async getAll() {
        return database_1.prisma.outlet.findMany({
            orderBy: { createdAt: 'desc' },
            include: { user: true }
        });
    }
    async getByUserId(userId) {
        return database_1.prisma.outlet.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    }
    async getById(id) {
        return database_1.prisma.outlet.findUnique({
            where: { id },
            include: { billing: true }
        });
    }
    //
    // ----------- CREATE -----------
    //
    async createStrict(data) {
        // Backend business rule enforcement
        if (!data.primaryContactName || !data.contactEmail || !data.contactPhone) {
            throw new Error('Missing required onboarding fields');
        }
        return database_1.prisma.outlet.create({
            data: {
                name: data.name,
                userId: data.userId,
                primaryContactName: data.primaryContactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                subscriptionPlan: data.subscriptionPlan,
                subscriptionStatus: client_1.SubscriptionStatus.TRIAL,
                apiStatus: client_1.ApiStatus.DISABLED,
                onboardingStatus: client_1.OnboardingStatus.PENDING
            }
        });
    }
    //
    // ----------- UPDATE -----------
    //
    async update(id, data) {
        return database_1.prisma.outlet.update({
            where: { id },
            data: {
                ...data,
                updatedAt: new Date()
            }
        });
    }
    //
    // ----------- STATUS UPDATE ENFORCING RULES -----------
    //
    async updateStatus(id, status) {
        return database_1.prisma.outlet.update({
            where: { id },
            data: { status, updatedAt: new Date() }
        });
    }
    /**
     * Enforce:
     * - API ENABLED only if:
     *   subscriptionStatus = ACTIVE
     */
    async setApiStatus(id, apiStatus) {
        const outlet = await this.getById(id);
        if (!outlet)
            throw new Error('Outlet not found');
        if (apiStatus === client_1.ApiStatus.ENABLED &&
            outlet.subscriptionStatus !== client_1.SubscriptionStatus.ACTIVE) {
            throw new Error('API cannot be enabled on inactive subscription');
        }
        return database_1.prisma.outlet.update({
            where: { id },
            data: {
                apiStatus,
                updatedAt: new Date()
            }
        });
    }
    /**
     * Enforce onboarding completion conditions
     */
    async markOnboardingCompleted(id) {
        const outlet = await this.getById(id);
        if (!outlet)
            throw new Error('Outlet not found');
        if (!outlet.contactEmail || !outlet.contactPhone || !outlet.primaryContactName) {
            throw new Error('Cannot complete onboarding without required contact fields');
        }
        return database_1.prisma.outlet.update({
            where: { id },
            data: {
                onboardingStatus: client_1.OnboardingStatus.COMPLETED
            }
        });
    }
    //
    // ----------- METRICS FIXED -----------
    //
    async getHealthMetrics(id) {
        const outlet = await database_1.prisma.outlet.findUnique({
            where: { id },
            include: {
                reviews: true,
                billing: true,
                manualReviewQueue: true
            }
        });
        if (!outlet)
            return null;
        const totalReviews = outlet.reviews.length;
        const closedReviews = outlet.reviews.filter(r => r.status === 'CLOSED').length;
        const manualPending = outlet.reviews.filter(r => r.status === 'MANUAL_PENDING').length;
        const autoReplied = outlet.reviews.filter(r => r.status === 'AUTO_REPLIED').length;
        const avgRating = totalReviews === 0
            ? 0
            : outlet.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
        return {
            id: outlet.id,
            name: outlet.name,
            status: outlet.status,
            subscriptionStatus: outlet.subscriptionStatus,
            billingStatus: outlet.billing?.status ?? null,
            totalReviews,
            closedReviews,
            manualPending,
            autoReplied,
            avgRating: Number(avgRating.toFixed(2))
        };
    }
    //
    // ----------- DELETE -----------
    //
    async delete(id) {
        return database_1.prisma.outlet.delete({
            where: { id }
        });
    }
    // Compatibility aliases to match legacy API used across controllers
    async createOutlet(data) {
        return this.createStrict(data);
    }
    async completeOnboarding(id) {
        return this.markOnboardingCompleted(id);
    }
    async getOutletsByUserId(userId) {
        return this.getByUserId(userId);
    }
    async getOutletById(id) {
        return this.getById(id);
    }
    async getAllOutlets() {
        return this.getAll();
    }
    /**
     * Update Google connection status for an outlet
     */
    async updateGoogleConnection(outletId, googlePlaceId, googleLocationName, googleConnected) {
        return database_1.prisma.outlet.update({
            where: { id: outletId },
            data: {
                googlePlaceId,
                googleLocationName,
                googleConnected
            }
        });
    }
    /**
     * Set Google connected status to true
     */
    async setGoogleConnected(outletId, googlePlaceId, googleLocationName) {
        return this.updateGoogleConnection(outletId, googlePlaceId, googleLocationName, true);
    }
    /**
     * Disconnect Google integration
     */
    async disconnectGoogle(outletId) {
        return this.updateGoogleConnection(outletId, null, null, false);
    }
}
exports.OutletRepository = OutletRepository;
exports.outletsRepository = new OutletRepository();
//# sourceMappingURL=outlets.repo.js.map