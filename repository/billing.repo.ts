import { prisma } from "./base.repo"
import type { Billing, SubscriptionStatus } from "@prisma/client"

export class BillingRepository {
  async getBillingByOutletId(outletId: string): Promise<Billing | null> {
    return prisma.billing.findUnique({
      where: { outletId },
    })
  }

  async createBilling(data: {
    outletId: string
    status?: SubscriptionStatus
    trialEndsAt?: Date
  }): Promise<Billing> {
    const TRIAL_DAYS = 30

    const trialEndsAt = data.trialEndsAt ?? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

    return prisma.billing.create({
      data: {
        outletId: data.outletId,
        status: data.status ?? "TRIAL",
        trialEndsAt,
      },
    })
  }

  async updateSubscriptionStatus(outletId: string, status: SubscriptionStatus): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        status,
        updatedAt: new Date(),
      },
    })
  }

  async updatePaidUntil(outletId: string, paidUntil: Date): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        paidUntil,
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    })
  }

  async deactivateBilling(outletId: string): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        status: "INACTIVE",
        updatedAt: new Date(),
      },
    })
  }

  async activateBilling(outletId: string): Promise<Billing> {
    return prisma.billing.update({
      where: { outletId },
      data: {
        status: "ACTIVE",
        updatedAt: new Date(),
      },
    })
  }

  async getActivePaidSubscriptions(): Promise<Billing[]> {
    return prisma.billing.findMany({
      where: {
        status: "ACTIVE",
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
        status: "TRIAL",
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
        status: "ACTIVE",
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

    if (billing.status === "TRIAL" && billing.trialEndsAt && billing.trialEndsAt < now) {
      await this.updateSubscriptionStatus(outletId, "INACTIVE")
      return
    }

    if (billing.status === "ACTIVE" && billing.paidUntil && billing.paidUntil < now) {
      await this.updateSubscriptionStatus(outletId, "PAST_DUE")
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
    const activePaid = billings.filter((b) => b.status === "ACTIVE").length
    const trials = billings.filter((b) => b.status === "TRIAL").length
    const inactive = billings.filter((b) => b.status === "INACTIVE").length
    const totalReviews = billings.reduce((sum, b) => sum + b.outlet.reviews.length, 0)

    const MONTHLY_PRICE = 29
    const monthlyRecurringRevenue = billings
      .filter((b) => b.status === "ACTIVE")
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
