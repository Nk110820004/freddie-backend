"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentRepository = exports.PaymentRepository = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class PaymentRepository {
    async createPayment(data) {
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
        });
    }
    async updatePaymentStatus(razorpayPaymentId, status) {
        // First update the payment record
        await prisma.payment.updateMany({
            where: { razorpayPaymentId },
            data: { status },
        });
        // Then return the updated payment
        return prisma.payment.findFirst({
            where: { razorpayPaymentId },
            orderBy: { createdAt: "desc" },
        });
    }
    async getPaymentByOrderId(orderId) {
        return prisma.payment.findUnique({
            where: { razorpayOrderId: orderId },
        });
    }
    async getPaymentByPaymentId(paymentId) {
        return prisma.payment.findUnique({
            where: { razorpayPaymentId: paymentId },
        });
    }
    async getUserPayments(userId, limit = 50) {
        return prisma.payment.findMany({
            where: { userId },
            take: limit,
            orderBy: { createdAt: "desc" },
        });
    }
    async getOutletPayments(outletId, limit = 50) {
        return prisma.payment.findMany({
            where: { outletId },
            take: limit,
            orderBy: { createdAt: "desc" },
        });
    }
}
exports.PaymentRepository = PaymentRepository;
exports.paymentRepository = new PaymentRepository();
//# sourceMappingURL=payment.repo.js.map