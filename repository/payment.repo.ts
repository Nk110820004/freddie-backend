import { PrismaClient, type Payment, type PaymentStatus, type BillingPlan } from "@prisma/client"

const prisma = new PrismaClient()

export class PaymentRepository {
  async createPayment(data: {
    razorpayOrderId: string
    amount: number
    currency?: string
    planType: BillingPlan
    userId: string
    outletId: string
  }): Promise<Payment> {
    return prisma.payment.create({
      data: {
        razorpayOrderId: data.razorpayOrderId,
        amount: data.amount,
        currency: data.currency || "INR",
        planType: data.planType,
        status: "PENDING",
        userId: data.userId,
        outletId: data.outletId,
      },
    })
  }

  async updatePaymentStatus(razorpayPaymentId: string, status: PaymentStatus): Promise<Payment | null> {
    // First update the payment record
    await prisma.payment.updateMany({
      where: { razorpayPaymentId },
      data: { status },
    })

    // Then return the updated payment
    return prisma.payment.findFirst({
      where: { razorpayPaymentId },
      orderBy: { createdAt: "desc" },
    })
  }

  async getPaymentByOrderId(orderId: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { razorpayOrderId: orderId },
    })
  }

  async getPaymentByPaymentId(paymentId: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { razorpayPaymentId: paymentId },
    })
  }

  async getUserPayments(userId: string, limit = 50): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: "desc" },
    })
  }

  async getOutletPayments(outletId: string, limit = 50): Promise<Payment[]> {
    return prisma.payment.findMany({
      where: { outletId },
      take: limit,
      orderBy: { createdAt: "desc" },
    })
  }
}

export const paymentRepository = new PaymentRepository()
