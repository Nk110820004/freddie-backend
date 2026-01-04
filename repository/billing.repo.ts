import { prisma } from "./base.repo"
import type { Billing, BillingPlan } from "@prisma/client"

export class BillingRepository {
  async getBillingByOutletId(outletId: string): Promise<Billing | null> {
    return prisma.billing.findUnique({
      where: { outletId },
    })
  }

  async createBilling(data: {
    outletId: string
    plan?: BillingPlan
    trialEndsAt?: Date
  }): Promise<Billing> {
    const TRIAL_DAYS = 30

    const trialEndsAt = data.trialEndsAt ?? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    return prisma.billing.create({
      data: {
        outletId: data.outletId,
        plan: data.plan ?? "TRIAL",
        trialEndsAt,
      },
    })
  }

  async updateBillingPlan(outletId: string, plan: BillingPlan): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        plan,
        updatedAt: new Date(),
      },
    })
  }

  async updatePaidUntil(outletId: string, paidUntil: Date): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        paidUntil,
        plan: "PAID",
        isActive: true,
        updatedAt: new Date(),
      },
    })
  }

  async deactivateBilling(outletId: string): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    })
  }

  async activateBilling(outletId: string): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    })
  }

  async getActivePaidSubscriptions(): Promise<Billing[]> {
    return prisma.billing.findMany({
      where: {
        plan: "PAID",
        isActive: true,
      },
      include: {
        outlet: true,
      },
    })
  }

  async getExpiringTrials(daysBeforeExpiry = 3): Promise<Billing[]> {
    const now = new Date()
    const threshold = new Date(now.getTime() + daysBeforeExpiry * 24 * 60 * 60 * 1000)

    return prisma.billing.findMany({
      where: {
        plan: "TRIAL",
        trialEndsAt: {
          lte: threshold,
          gt: now,
        },
      },
      include: {
        outlet: true,
      },
    })
  }

  async getOverdueBillings(): Promise<Billing[]> {
    return prisma.billing.findMany({
      where: {
        paidUntil: { lt: new Date() },
        isActive: true,
      },
      include: {
        outlet: true,
      },
    })
  }

  async enforceBillingRules(outletId: string): Promise<void> {
    const billing = await this.getBillingByOutletId(outletId)

    if (!billing) return

    const now = new Date()

    if (billing.plan === "TRIAL" && billing.trialEndsAt && billing.trialEndsAt < now) {
      await this.deactivateBilling(outletId)
      return
    }

    if (billing.plan === "PAID" && billing.paidUntil && billing.paidUntil < now) {
      await this.deactivateBilling(outletId)
      return
    }
  }

  async getBillingStats() {
    const billings = await prisma.billing.findMany({
      include: {
        outlet: {
          include: {
            reviews: true,
          },
        },
      },
    })

    const total = billings.length
    const activePaid = billings.filter((b) => b.plan === "PAID" && b.isActive).length
    const trials = billings.filter((b) => b.plan === "TRIAL").length
    const inactive = billings.filter((b) => !b.isActive).length
    const totalReviews = billings.reduce((sum, b) => sum + b.outlet.reviews.length, 0)

    const MONTHLY_PRICE = 29
    const monthlyRecurringRevenue = billings
      .filter((b) => b.plan === "PAID" && b.isActive)
      .reduce((sum) => sum + MONTHLY_PRICE, 0)

    return {
      total,
      activePaid,
      trials,
      inactive,
      totalReviews,
      monthlyRecurringRevenue,
    }
  }

  async deleteBilling(outletId: string): Promise<Billing> {
    return prisma.billing.delete({
      where: { outletId },
    })
  }
}

export const billingRepository = new BillingRepository()
