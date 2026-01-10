"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkOutletCompliance = checkOutletCompliance;
exports.validateOnboarding = validateOnboarding;
exports.validateSubscriptionUpdate = validateSubscriptionUpdate;
exports.enforceAutomationEligibility = enforceAutomationEligibility;
const database_1 = require("../database");
const client_1 = require("@prisma/client");
const logger_1 = require("../utils/logger");
/**
 * Enforces that the outlet has an active subscription and API enabled
 * to access automation or advanced features.
 */
async function checkOutletCompliance(req, res, next) {
    const outletId = req.headers["x-outlet-id"];
    if (!outletId) {
        return next(); // skip if no outlet context
    }
    try {
        const outlet = await database_1.prisma.outlet.findUnique({
            where: { id: outletId },
            select: {
                apiStatus: true,
                billing: {
                    select: {
                        status: true,
                    },
                },
                subscriptionStatus: true,
                onboardingStatus: true,
            },
        });
        if (!outlet) {
            res.status(404).json({ error: "Outlet not found" });
            return;
        }
        if (outlet.onboardingStatus !== client_1.OnboardingStatus.COMPLETED) {
            res.status(403).json({
                error: "Onboarding incomplete",
                message: "Complete outlet onboarding before accessing this feature",
            });
            return;
        }
        if (outlet.apiStatus !== client_1.ApiStatus.ENABLED) {
            res.status(403).json({
                error: "API features are DISABLED",
                message: "API is disabled for this outlet. Check subscription status.",
            });
            return;
        }
        if (outlet.billing?.status !== client_1.SubscriptionStatus.ACTIVE) {
            res.status(403).json({
                error: "Billing is SUSPENDED",
                message: "Billing status prevents API access.",
            });
            return;
        }
        if (outlet.subscriptionStatus === client_1.SubscriptionStatus.EXPIRED) {
            res.status(403).json({
                error: "Subscription has EXPIRED",
                message: "Renew your subscription to continue using this feature.",
            });
            return;
        }
        if (outlet.subscriptionStatus === client_1.SubscriptionStatus.UNPAID) {
            res.status(403).json({
                error: "Subscription is UNPAID",
                message: "Please complete payment to access this feature.",
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error("Compliance check failed", error);
        res.status(500).json({ error: "Compliance check failed" });
    }
}
/**
 * Validates that onboarding fields are complete
 */
async function validateOnboarding(req, res, next) {
    const { name, email, whatsappNumber, outletName, category, subscriptionPlan } = req.body;
    if (!name || !email || !whatsappNumber || !outletName) {
        res.status(400).json({
            error: "Incomplete onboarding data",
            message: "Name, email, WhatsApp number, and outlet name are required",
        });
        return;
    }
    if (!category) {
        res.status(400).json({
            error: "Business category is required",
        });
        return;
    }
    if (!subscriptionPlan) {
        res.status(400).json({
            error: "Subscription plan is required",
        });
        return;
    }
    next();
}
/**
 * Enforces subscription update business rules
 */
async function validateSubscriptionUpdate(req, res, next) {
    const { subscriptionStatus, billingStatus, apiStatus } = req.body;
    if (apiStatus === client_1.ApiStatus.ENABLED) {
        if (!subscriptionStatus || ![client_1.SubscriptionStatus.PAID, client_1.SubscriptionStatus.PARTIAL].includes(subscriptionStatus)) {
            res.status(400).json({
                error: "Invalid API enablement",
                message: "API can only be enabled when subscription is PAID or PARTIAL",
            });
            return;
        }
        if (billingStatus && billingStatus !== client_1.SubscriptionStatus.ACTIVE) {
            res.status(400).json({
                error: "Invalid API enablement",
                message: "API can only be enabled when billing is ACTIVE",
            });
            return;
        }
    }
    if ([client_1.SubscriptionStatus.EXPIRED, client_1.SubscriptionStatus.UNPAID].includes(subscriptionStatus) &&
        apiStatus === client_1.ApiStatus.ENABLED) {
        res.status(400).json({
            error: "Invalid subscription state",
            message: "EXPIRED or UNPAID subscriptions cannot have API enabled",
        });
        return;
    }
    next();
}
/**
 * Blocks automation/review endpoints if outlet is not eligible
 */
async function enforceAutomationEligibility(req, res, next) {
    const outletId = req.headers["x-outlet-id"] || req.body.outletId || req.params.outletId;
    if (!outletId) {
        res.status(400).json({ error: "Outlet ID is required" });
        return;
    }
    try {
        const outlet = await database_1.prisma.outlet.findUnique({
            where: { id: outletId },
            select: {
                apiStatus: true,
                billing: {
                    select: {
                        status: true,
                    },
                },
                subscriptionStatus: true,
            },
        });
        if (!outlet) {
            res.status(404).json({ error: "Outlet not found" });
            return;
        }
        const normalizedSubscriptionStatus = outlet.subscriptionStatus === client_1.SubscriptionStatus.PAST_DUE
            ? client_1.SubscriptionStatus.PARTIAL
            : outlet.subscriptionStatus;
        const isEligible = outlet.apiStatus === client_1.ApiStatus.ENABLED &&
            [
                client_1.SubscriptionStatus.PAID,
                client_1.SubscriptionStatus.PARTIAL,
                client_1.SubscriptionStatus.TRIAL,
                client_1.SubscriptionStatus.ACTIVE,
            ].includes(normalizedSubscriptionStatus);
        if (!isEligible) {
            res.status(403).json({
                error: "Automation not available",
                message: "Outlet does not meet eligibility requirements for automation features",
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error("Automation eligibility check failed", error);
        res.status(500).json({ error: "Eligibility check failed" });
    }
}
//# sourceMappingURL=compliance.middleware.js.map