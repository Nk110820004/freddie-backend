import {
  type PrismaClient,
  SubscriptionStatus,
  BillingStatus,
  ApiStatus,
  OnboardingStatus,
  type BusinessCategory,
  type SubscriptionPlan,
} from "@prisma/client"
import { BaseRepository } from "./base.repo"

export interface CreateOutletDTO {
  name: string
  groupName?: string
  primaryContactName: string
  contactEmail: string
  contactPhone: string
  category: BusinessCategory
  subscriptionPlan: SubscriptionPlan
  subscriptionStatus?: SubscriptionStatus
  userId: string
  googlePlaceId?: string
  googleLocationName?: string
}

export interface UpdateOutletSubscriptionDTO {
  subscriptionStatus?: SubscriptionStatus
  billingStatus?: BillingStatus
  apiStatus?: ApiStatus
  remarks: string
}

export class OutletRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma)
  }

  async createOutlet(data: CreateOutletDTO) {
    const { userId, ...outletData } = data

    // Enforce: new outlets start with DISABLED API
    const outlet = await this.prisma.outlet.create({
      data: {
        ...outletData,
        apiStatus: ApiStatus.DISABLED,
        onboardingStatus: OnboardingStatus.PENDING,
        subscriptionStatus: data.subscriptionStatus || SubscriptionStatus.TRIAL,
        billingStatus: BillingStatus.ACTIVE,
        user: {
          connect: { id: userId },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            whatsappNumber: true,
          },
        },
      },
    })

    return outlet
  }

  async updateOutletSubscription(outletId: string, adminId: string, updates: UpdateOutletSubscriptionDTO) {
    const { remarks, ...updateData } = updates

    // Get current state for audit
    const currentOutlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        subscriptionStatus: true,
        billingStatus: true,
        apiStatus: true,
      },
    })

    if (!currentOutlet) {
      throw new Error("Outlet not found")
    }

    // Business rule enforcement
    if (updateData.apiStatus === ApiStatus.ENABLED) {
      const finalSubscriptionStatus = updateData.subscriptionStatus || currentOutlet.subscriptionStatus
      const finalBillingStatus = updateData.billingStatus || currentOutlet.billingStatus

      if (![SubscriptionStatus.PAID, SubscriptionStatus.PARTIAL].includes(finalSubscriptionStatus)) {
        throw new Error("API cannot be ENABLED unless subscription is PAID or PARTIAL")
      }

      if (finalBillingStatus !== BillingStatus.ACTIVE) {
        throw new Error("API cannot be ENABLED unless billing is ACTIVE")
      }
    }

    // If subscription becomes UNPAID, auto-disable API
    if (updateData.subscriptionStatus === SubscriptionStatus.UNPAID) {
      updateData.apiStatus = ApiStatus.DISABLED
    }

    // Perform update in transaction with audit log
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.outlet.update({
        where: { id: outletId },
        data: updateData,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              whatsappNumber: true,
            },
          },
        },
      })

      // Create audit entries for each changed field
      const auditPromises = []

      if (updateData.subscriptionStatus && updateData.subscriptionStatus !== currentOutlet.subscriptionStatus) {
        auditPromises.push(
          tx.subscriptionAuditLog.create({
            data: {
              outletId,
              adminId,
              action: "SUBSCRIPTION_STATUS_CHANGE",
              oldValue: currentOutlet.subscriptionStatus,
              newValue: updateData.subscriptionStatus,
              remarks,
            },
          }),
        )
      }

      if (updateData.billingStatus && updateData.billingStatus !== currentOutlet.billingStatus) {
        auditPromises.push(
          tx.subscriptionAuditLog.create({
            data: {
              outletId,
              adminId,
              action: "BILLING_STATUS_CHANGE",
              oldValue: currentOutlet.billingStatus,
              newValue: updateData.billingStatus,
              remarks,
            },
          }),
        )
      }

      if (updateData.apiStatus && updateData.apiStatus !== currentOutlet.apiStatus) {
        auditPromises.push(
          tx.subscriptionAuditLog.create({
            data: {
              outletId,
              adminId,
              action: "API_STATUS_CHANGE",
              oldValue: currentOutlet.apiStatus,
              newValue: updateData.apiStatus,
              remarks,
            },
          }),
        )
      }

      await Promise.all(auditPromises)

      return updated
    })

    return result
  }

  async completeOnboarding(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
    })

    if (!outlet) {
      throw new Error("Outlet not found")
    }

    // Validate required fields
    if (!outlet.primaryContactName || !outlet.contactEmail || !outlet.contactPhone) {
      throw new Error("Cannot complete onboarding: missing required contact fields")
    }

    if (outlet.subscriptionStatus === SubscriptionStatus.UNPAID) {
      throw new Error("Cannot complete onboarding with UNPAID subscription")
    }

    return this.prisma.outlet.update({
      where: { id: outletId },
      data: {
        onboardingStatus: OnboardingStatus.COMPLETED,
      },
    })
  }

  async getEligibleOutlets() {
    return this.prisma.outlet.findMany({
      where: {
        apiStatus: ApiStatus.ENABLED,
        billingStatus: BillingStatus.ACTIVE,
        subscriptionStatus: {
          in: [SubscriptionStatus.PAID, SubscriptionStatus.PARTIAL],
        },
        onboardingStatus: OnboardingStatus.COMPLETED,
      },
      include: {
        user: {
          select: {
            googleEmail: true,
            googleRefreshToken: true,
            gmbAccountId: true,
            whatsappNumber: true,
          },
        },
      },
    })
  }

  async checkAndDisableExpiredTrials() {
    const now = new Date()

    const expiredTrials = await this.prisma.outlet.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.TRIAL,
        billing: {
          trialEndsAt: {
            lte: now,
          },
        },
      },
      include: {
        billing: true,
      },
    })

    const updatePromises = expiredTrials.map((outlet) =>
      this.prisma.outlet.update({
        where: { id: outlet.id },
        data: {
          subscriptionStatus: SubscriptionStatus.EXPIRED,
          apiStatus: ApiStatus.DISABLED,
        },
      }),
    )

    return Promise.all(updatePromises)
  }

  async getOutletById(id: string) {
    return this.prisma.outlet.findUnique({
      where: { id },
      include: {
        user: true,
        billing: true,
      },
    })
  }

  async getAllOutlets() {
    return this.prisma.outlet.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        billing: true,
        _count: {
          select: {
            reviews: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  }
}
