import { prisma } from './base.repo';
import { Outlet, OutletStatus } from '@prisma/client';

/**
 * Get all outlets
 */
export async function getAllOutlets(): Promise<Outlet[]> {
  return prisma.outlet.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get outlets owned by a specific user
 */
export async function getOutletsByUserId(userId: string): Promise<Outlet[]> {
  return prisma.outlet.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get outlet by ID
 */
export async function getOutletById(id: string): Promise<Outlet | null> {
  return prisma.outlet.findUnique({
    where: { id },
  });
}

/**
 * Create new outlet
 */
export async function createOutlet(data: {
  name: string;
  userId: string;
}): Promise<Outlet> {
  return prisma.outlet.create({
    data: {
      name: data.name,
      userId: data.userId,
    },
  });
}

/**
 * Update outlet details
 */
export async function updateOutlet(
  id: string,
  data: Partial<Outlet>
): Promise<Outlet> {
  return prisma.outlet.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update outlet status (ACTIVE | PAUSED | DISABLED)
 */
export async function updateOutletStatus(
  id: string,
  status: OutletStatus
): Promise<Outlet> {
  return prisma.outlet.update({
    where: { id },
    data: {
      status,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get only ACTIVE outlets
 */
export async function getActiveOutlets(): Promise<Outlet[]> {
  return prisma.outlet.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Compute outlet health metrics for dashboard
 */
export async function getOutletHealthMetrics(id: string) {
  const outlet = await prisma.outlet.findUnique({
    where: { id },
    include: {
      reviews: true,
      billing: true,
    },
  });

  if (!outlet) return null;

  const totalReviews = outlet.reviews.length;

  const closedReviews = outlet.reviews.filter(
    r => r.status === 'CLOSED'
  ).length;

  const escalatedReviews = outlet.reviews.filter(
    r => r.status === 'ESCALATED'
  ).length;

  const avgRating =
    totalReviews > 0
      ? outlet.reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

  return {
    id: outlet.id,
    name: outlet.name,
    status: outlet.status,
    billingPlan: outlet.billing?.plan ?? null,
    totalReviews,
    closedReviews,
    escalatedReviews,
    pendingReviews: totalReviews - closedReviews - escalatedReviews,
    avgRating: Number(avgRating.toFixed(2)),
  };
}

/**
 * Hard delete outlet (cascades reviews/billing via Prisma relations)
 */
export async function deleteOutlet(id: string): Promise<Outlet> {
  return prisma.outlet.delete({
    where: { id },
  });
}

// Export repository object with all methods
export const outletsRepository = {
  getAllOutlets,
  getOutletsByUserId,
  getOutletById,
  createOutlet,
  updateOutlet,
  updateOutletStatus,
  getActiveOutlets,
  getOutletHealthMetrics,
  deleteOutlet,
};
