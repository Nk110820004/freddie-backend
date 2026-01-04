import { prisma } from './base.repo';
import { Review, ReviewStatus } from '@prisma/client';

/**
 * Fetch all reviews (admin global view)
 */
export async function getAllReviews(): Promise<Review[]> {
  return prisma.review.findMany({
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Reviews for a specific outlet
 */
export async function getReviewsByOutlet(
  outletId: string,
  limit = 50,
  offset = 0
): Promise<Review[]> {
  return prisma.review.findMany({
    where: { outletId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    skip: offset,
  });
}

/**
 * Single review by id
 */
export async function getReviewById(id: string): Promise<Review | null> {
  return prisma.review.findUnique({
    where: { id },
  });
}

/**
 * Get outlet by review id
 */
export async function getOutletByReviewId(reviewId: string) {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { outlet: true },
  });
  return review?.outlet || null;
}

/**
 * Create a review
 * (admin/manual import or GMB sync if later added)
 */
export async function createReview(data: {
  outletId: string;
  rating: number;
  customerName: string;
  reviewText: string;
}): Promise<Review> {
  return prisma.review.create({
    data: {
      outletId: data.outletId,
      rating: data.rating,
      customerName: data.customerName,
      reviewText: data.reviewText,
    },
  });
}

/**
 * Update review fields
 */
export async function updateReview(
  id: string,
  data: Partial<Review>
): Promise<Review> {
  return prisma.review.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update review status only
 */
export async function updateReviewStatus(
  id: string,
  status: ReviewStatus
): Promise<Review> {
  return prisma.review.update({
    where: { id },
    data: {
      status,
      updatedAt: new Date(),
    },
  });
}

/**
 * Get escalated (low-rated) reviews only
 */
export async function getEscalatedReviews(
  limit = 100
): Promise<Review[]> {
  return prisma.review.findMany({
    where: {
      status: 'ESCALATED',
      rating: { lte: 3 },
    },
    include: {
      outlet: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * High-rated pending reviews
 */
export async function getHighRatedReviews(
  limit = 100
): Promise<Review[]> {
  return prisma.review.findMany({
    where: {
      status: 'PENDING',
      rating: { gte: 4 },
    },
    include: {
      outlet: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Analytics used in admin dashboard
 */
export async function getReviewAnalytics(
  outletId: string,
  days = 30
) {
  const start = new Date();
  start.setDate(start.getDate() - days);

  const reviews = await prisma.review.findMany({
    where: {
      outletId,
      createdAt: { gte: start },
    },
  });

  const total = reviews.length;

  const avgRating =
    total > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / total
      : 0;

  const closed = reviews.filter(r => r.status === 'CLOSED').length;
  const escalated = reviews.filter(r => r.status === 'ESCALATED').length;
  const pending = reviews.filter(r => r.status === 'PENDING').length;

  const ratingDistribution = {
    five: reviews.filter(r => r.rating === 5).length,
    four: reviews.filter(r => r.rating === 4).length,
    three: reviews.filter(r => r.rating === 3).length,
    two: reviews.filter(r => r.rating === 2).length,
    one: reviews.filter(r => r.rating === 1).length,
  };

  return {
    total,
    avgRating: Number(avgRating.toFixed(2)),
    closed,
    escalated,
    pending,
    ratingDistribution,
    periodDays: days,
  };
}

/**
 * Delete review permanently
 */
export async function deleteReview(id: string): Promise<Review> {
  return prisma.review.delete({
    where: { id },
  });
}

// Export repository object with all methods
export const reviewsRepository = {
  getAllReviews,
  getReviewsByOutlet,
  getReviewById,
  createReview,
  updateReview,
  updateReviewStatus,
  getEscalatedReviews,
  getHighRatedReviews,
  getReviewAnalytics,
  deleteReview,
};
