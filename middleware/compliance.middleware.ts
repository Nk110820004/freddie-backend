import type { Response, NextFunction } from "express"
import type { AuthRequest } from "./auth.middleware"
import { prisma } from "../lib/prisma"
import { ApiStatus, BillingStatus, SubscriptionStatus, OnboardingStatus } from "@prisma/client"
import { logger } from "../utils/logger"

/**
 * Enforces that the outlet has an active subscription and API enabled
 * to access automation or advanced features.
 */
export async function checkOutletCompliance(req: AuthRequest, res: Response, next: NextFunction) {
  const outletId = req.headers["x-outlet-id"] as string

  if (!outletId) {
    return next() // skip if no outlet context
  }

  try {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        apiStatus: true,
        billingStatus: true,
        subscriptionStatus: true,
        onboardingStatus: true,
      },
    })

    if (!outlet) {
      res.status(404).json({ error: "Outlet not found" })
      return
    }

    if (outlet.onboardingStatus !== OnboardingStatus.COMPLETED) {
      res.status(403).json({
        error: "Onboarding incomplete",
        message: "Complete outlet onboarding before accessing this feature",
      })
      return
    }

    if (outlet.apiStatus !== ApiStatus.ENABLED) {
      res.status(403).json({
        error: "API features are DISABLED",
        message: "API is disabled for this outlet. Check subscription status.",
      })
      return
    }

    if (outlet.billingStatus !== BillingStatus.ACTIVE) {
      res.status(403).json({
        error: "Billing is SUSPENDED",
        message: "Billing status prevents API access.",
      })
      return
    }

    if (outlet.subscriptionStatus === SubscriptionStatus.EXPIRED) {
      res.status(403).json({
        error: "Subscription has EXPIRED",
        message: "Renew your subscription to continue using this feature.",
      })
      return
    }

    if (outlet.subscriptionStatus === SubscriptionStatus.UNPAID) {
      res.status(403).json({
        error: "Subscription is UNPAID",
        message: "Please complete payment to access this feature.",
      })
      return
    }

    next()
  } catch (error) {
    logger.error("Compliance check failed", error)
    res.status(500).json({ error: "Compliance check failed" })
  }
}

/**
 * Validates that onboarding fields are complete
 */
export async function validateOnboarding(req: AuthRequest, res: Response, next: NextFunction) {
  const { name, email, whatsappNumber, outletName, category, subscriptionPlan } = req.body

  if (!name || !email || !whatsappNumber || !outletName) {
    res.status(400).json({
      error: "Incomplete onboarding data",
      message: "Name, email, WhatsApp number, and outlet name are required",
    })
    return
  }

  if (!category) {
    res.status(400).json({
      error: "Business category is required",
    })
    return
  }

  if (!subscriptionPlan) {
    res.status(400).json({
      error: "Subscription plan is required",
    })
    return
  }

  next()
}

/**
 * Enforces subscription update business rules
 */
export async function validateSubscriptionUpdate(req: AuthRequest, res: Response, next: NextFunction) {
  const { subscriptionStatus, billingStatus, apiStatus } = req.body

  if (apiStatus === ApiStatus.ENABLED) {
    if (!subscriptionStatus || ![SubscriptionStatus.PAID, SubscriptionStatus.PARTIAL].includes(subscriptionStatus)) {
      res.status(400).json({
        error: "Invalid API enablement",
        message: "API can only be enabled when subscription is PAID or PARTIAL",
      })
      return
    }

    if (billingStatus && billingStatus !== BillingStatus.ACTIVE) {
      res.status(400).json({
        error: "Invalid API enablement",
        message: "API can only be enabled when billing is ACTIVE",
      })
      return
    }
  }

  if (
    [SubscriptionStatus.EXPIRED, SubscriptionStatus.UNPAID].includes(subscriptionStatus) &&
    apiStatus === ApiStatus.ENABLED
  ) {
    res.status(400).json({
      error: "Invalid subscription state",
      message: "EXPIRED or UNPAID subscriptions cannot have API enabled",
    })
    return
  }

  next()
}

/**
 * Blocks automation/review endpoints if outlet is not eligible
 */
export async function enforceAutomationEligibility(req: AuthRequest, res: Response, next: NextFunction) {
  const outletId = (req.headers["x-outlet-id"] as string) || req.body.outletId || req.params.outletId

  if (!outletId) {
    res.status(400).json({ error: "Outlet ID is required" })
    return
  }

  try {
    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        apiStatus: true,
        billingStatus: true,
        subscriptionStatus: true,
      },
    })

    if (!outlet) {
      res.status(404).json({ error: "Outlet not found" })
      return
    }

    const isEligible =
      outlet.apiStatus === ApiStatus.ENABLED &&
      outlet.billingStatus === BillingStatus.ACTIVE &&
      [SubscriptionStatus.PAID, SubscriptionStatus.PARTIAL, SubscriptionStatus.TRIAL].includes(
        outlet.subscriptionStatus,
      )

    if (!isEligible) {
      res.status(403).json({
        error: "Automation not available",
        message: "Outlet does not meet eligibility requirements for automation features",
      })
      return
    }

    next()
  } catch (error) {
    logger.error("Automation eligibility check failed", error)
    res.status(500).json({ error: "Eligibility check failed" })
  }
}
