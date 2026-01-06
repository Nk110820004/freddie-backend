import {
  type PrismaClient,
  type BusinessCategory,
  type SubscriptionPlan,
  SubscriptionStatus,
  OnboardingStatus,
  ApiStatus
} from "@prisma/client";
import { BaseRepository } from "./base.repo";

export interface CreateOutletDTO {
  name: string;
  groupName?: string;
  primaryContactName: string;
  contactEmail: string;
  contactPhone: string;
  category: BusinessCategory;
  subscriptionPlan: SubscriptionPlan;
  userId: string;
  googlePlaceId?: string;
  googleLocationName?: string;
}

export class OutletRepository extends BaseRepository {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Create outlet + billing atomically
   * Enforces uniqueness & onboarding rules
   */
  async createOutlet(data: CreateOutletDTO) {
    return this.prisma.$transaction(async (tx) => {
      // Prevent duplicate contact phone/email
      const existing = await tx.outlet.findFirst({
        where: {
          OR: [
            { contactEmail: data.contactEmail },
            { contactPhone: data.contactPhone }
          ]
        }
      });

      if (existing) {
        throw new Error("Outlet with same email or phone already exists");
      }

      // Create outlet
      const outlet = await tx.outlet.create({
        data: {
          name: data.name,
          groupName: data.groupName,
          primaryContactName: data.primaryContactName,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
          category: data.category,
          subscriptionPlan: data.subscriptionPlan,

          apiStatus: ApiStatus.DISABLED,
          onboardingStatus: OnboardingStatus.PENDING,
          subscriptionStatus: SubscriptionStatus.TRIAL,

          googlePlaceId: data.googlePlaceId,
          googleLocationName: data.googleLocationName,

          user: { connect: { id: data.userId } }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              whatsappNumber: true
            }
          }
        }
      });

      // Create matching billing record atomically
      await tx.billing.create({
        data: {
          outletId: outlet.id,
          status: SubscriptionStatus.TRIAL
        }
      });

      return outlet;
    });
  }

  /**
   * Finalize onboarding when rules are satisfied
   */
  async completeOnboarding(outletId: string) {
    const outlet = await this.prisma.outlet.findUnique({
      where: { id: outletId },
      include: { billing: true }
    });

    if (!outlet) throw new Error("Outlet not found");

    if (!outlet.primaryContactName || !outlet.contactEmail || !outlet.contactPhone) {
      throw new Error("Missing required onboarding fields");
    }

    if (!outlet.billing) {
      throw new Error("Missing billing record for outlet");
    }

    if (
      outlet.billing.status === "CANCELED" ||
      outlet.billing.status === "INACTIVE"
    ) {
      throw new Error("Cannot complete onboarding with inactive subscription");
    }

    return this.prisma.outlet.update({
      where: { id: outletId },
      data: {
        onboardingStatus: OnboardingStatus.COMPLETED
      }
    });
  }

  /**
   * Outlets allowed for automation system
   */
  async getEligibleOutlets() {
    return this.prisma.outlet.findMany({
      where: {
        apiStatus: ApiStatus.ENABLED,
        onboardingStatus: OnboardingStatus.COMPLETED,
        billing: {
          status: SubscriptionStatus.ACTIVE
        }
      },
      include: {
        user: {
          select: {
            googleEmail: true,
            googleRefreshToken: true,
            gmbAccountId: true,
            whatsappNumber: true
          }
        }
      }
    });
  }

  async getOutletById(id: string) {
    return this.prisma.outlet.findUnique({
      where: { id },
      include: {
        user: true,
        billing: true
      }
    });
  }

  async getAllOutlets() {
    return this.prisma.outlet.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        billing: true,
        _count: { select: { reviews: true } }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  /**
   * Enforce API enable rules – MUST have active subscription
   */
  async setApiStatus(outletId: string, apiStatus: ApiStatus) {
    return this.prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        include: { billing: true }
      });

      if (!outlet) throw new Error("Outlet not found");

      if (apiStatus === ApiStatus.ENABLED) {
        if (
          !outlet.billing ||
          outlet.billing.status !== SubscriptionStatus.ACTIVE
        ) {
          throw new Error("Cannot enable API without active subscription");
        }
      }

      return tx.outlet.update({
        where: { id: outletId },
        data: { apiStatus }
      });
    });
  }
}
