import { prisma } from './base.repo';
import {
  Outlet,
  OutletStatus,
  SubscriptionStatus,
  ApiStatus,
  OnboardingStatus
} from '@prisma/client';

export class OutletRepository {
  //
  // ----------- READ -----------
  //

  async getAll(): Promise<Outlet[]> {
    return prisma.outlet.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  async getByUserId(userId: string): Promise<Outlet[]> {
    return prisma.outlet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getById(id: string): Promise<Outlet | null> {
    return prisma.outlet.findUnique({
      where: { id }
    });
  }

  //
  // ----------- CREATE -----------
  //
  async createStrict(data: {
    name: string;
    userId: string;
    primaryContactName: string;
    contactEmail: string;
    contactPhone: string;
    subscriptionPlan: string;
  }): Promise<Outlet> {
    // Backend business rule enforcement
    if (!data.primaryContactName || !data.contactEmail || !data.contactPhone) {
      throw new Error('Missing required onboarding fields');
    }

    return prisma.outlet.create({
      data: {
        name: data.name,
        userId: data.userId,
        primaryContactName: data.primaryContactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        subscriptionPlan: data.subscriptionPlan as any,
        subscriptionStatus: SubscriptionStatus.TRIAL,
        apiStatus: ApiStatus.DISABLED,
        onboardingStatus: OnboardingStatus.PENDING
      }
    });
  }

  //
  // ----------- UPDATE -----------
  //
  async update(id: string, data: Partial<Outlet>): Promise<Outlet> {
    return prisma.outlet.update({
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

  async updateStatus(id: string, status: OutletStatus): Promise<Outlet> {
    return prisma.outlet.update({
      where: { id },
      data: { status, updatedAt: new Date() }
    });
  }

  /**
   * Enforce:
   * - API ENABLED only if:
   *   subscriptionStatus = ACTIVE
   */
  async setApiStatus(id: string, apiStatus: ApiStatus): Promise<Outlet> {
    const outlet = await this.getById(id);
    if (!outlet) throw new Error('Outlet not found');

    if (
      apiStatus === ApiStatus.ENABLED &&
      outlet.subscriptionStatus !== SubscriptionStatus.ACTIVE
    ) {
      throw new Error('API cannot be enabled on inactive subscription');
    }

    return prisma.outlet.update({
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
  async markOnboardingCompleted(id: string) {
    const outlet = await this.getById(id);
    if (!outlet) throw new Error('Outlet not found');

    if (!outlet.contactEmail || !outlet.contactPhone || !outlet.primaryContactName) {
      throw new Error('Cannot complete onboarding without required contact fields');
    }

    return prisma.outlet.update({
      where: { id },
      data: {
        onboardingStatus: OnboardingStatus.COMPLETED
      }
    });
  }

  //
  // ----------- METRICS FIXED -----------
  //
  async getHealthMetrics(id: string) {
    const outlet = await prisma.outlet.findUnique({
      where: { id },
      include: {
        reviews: true,
        billing: true,
        manualReviewQueue: true
      }
    });

    if (!outlet) return null;

    const totalReviews = outlet.reviews.length;

    const closedReviews = outlet.reviews.filter(
      r => r.status === 'CLOSED'
    ).length;

    const manualPending = outlet.reviews.filter(
      r => r.status === 'MANUAL_PENDING'
    ).length;

    const autoReplied = outlet.reviews.filter(
      r => r.status === 'AUTO_REPLIED'
    ).length;

    const avgRating =
      totalReviews === 0
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
  async delete(id: string): Promise<Outlet> {
    return prisma.outlet.delete({
      where: { id }
    });
  }
}

export const outletsRepository = new OutletRepository();
