"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentController = exports.PaymentController = void 0;
const payment_repo_1 = require("../repository/payment.repo");
const billing_repo_1 = require("../repository/billing.repo");
const logger_1 = require("../utils/logger");
const audit_repo_1 = require("../repository/audit.repo");
const crypto_1 = __importDefault(require("crypto"));
// In production, use environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
class PaymentController {
    async createOrder(req, res) {
        try {
            const { outletId, planType, amount } = req.body;
            const userId = req.userId;
            if (!outletId || !planType || !amount) {
                res.status(400).json({
                    error: "outletId, planType, and amount are required",
                });
                return;
            }
            // Create Razorpay order (implement actual Razorpay API call when needed)
            const razorpayOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            if (!userId) {
                res.status(401).json({ error: 'Unauthorized' });
                return;
            }
            const payment = await payment_repo_1.paymentRepository.createPayment({
                razorpayOrderId,
                amount,
                planType,
                userId,
                outletId,
            });
            logger_1.logger.info(`Payment order created: ${razorpayOrderId}`, {
                outletId,
                planType,
                amount,
            });
            res.status(201).json({
                message: "Order created",
                orderId: razorpayOrderId,
                payment: {
                    id: payment.id,
                    razorpayOrderId: payment.razorpayOrderId,
                    amount: payment.amount,
                    currency: payment.currency,
                },
            });
            // Audit log: order created
            await audit_repo_1.auditRepository.createAuditLog({
                action: 'PAYMENT_ORDER_CREATED',
                entity: 'Payment',
                entityId: payment.id,
                userId: userId || null,
                details: JSON.stringify({ outletId, planType, amount }),
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to create payment order", error);
            res.status(500).json({ error: "Failed to create order" });
        }
    }
    async verifyPayment(req, res) {
        try {
            const { razorpay_order_id, razorpay_payment_id, razorpay_signature, outletId } = req.body;
            if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
                res.status(400).json({
                    error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
                });
                return;
            }
            // Verify signature
            const body = `${razorpay_order_id}|${razorpay_payment_id}`;
            const expectedSignature = crypto_1.default.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");
            if (expectedSignature !== razorpay_signature) {
                res.status(400).json({ error: "Invalid signature" });
                return;
            }
            // Get existing payment
            const payment = await payment_repo_1.paymentRepository.getPaymentByOrderId(razorpay_order_id);
            if (!payment) {
                res.status(404).json({ error: "Payment not found" });
                return;
            }
            // Update payment with Razorpay payment ID and mark as successful
            const updatedPayment = await payment_repo_1.paymentRepository.updatePaymentStatus(razorpay_payment_id, "SUCCESS");
            // Update billing status if payment successful
            if (updatedPayment && outletId) {
                await billing_repo_1.billingRepository.updatePaidUntil(outletId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
            }
            logger_1.logger.info(`Payment verified: ${razorpay_payment_id}`, {
                orderId: razorpay_order_id,
            });
            // Audit log: payment verified
            await audit_repo_1.auditRepository.createAuditLog({
                action: 'PAYMENT_VERIFIED',
                entity: 'Payment',
                entityId: updatedPayment?.id || null,
                userId: req.userId || null,
                details: JSON.stringify({ razorpay_order_id, razorpay_payment_id }),
            });
            res.status(200).json({
                message: "Payment verified successfully",
                payment: {
                    id: payment.id,
                    status: "SUCCESS",
                },
            });
        }
        catch (error) {
            logger_1.logger.error("Failed to verify payment", error);
            res.status(500).json({ error: "Failed to verify payment" });
        }
    }
    async webhook(req, res) {
        try {
            const signature = req.headers['x-razorpay-signature'] || req.headers['x-razorpay-signature'];
            const payload = req.body;
            const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
            if (!secret) {
                res.status(500).json({ error: 'Webhook secret not configured' });
                return;
            }
            const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
            const expected = crypto_1.default.createHmac('sha256', secret).update(payloadString).digest('hex');
            if (expected !== signature) {
                logger_1.logger.warn('Invalid razorpay webhook signature', { expected, signature });
                res.status(400).json({ error: 'Invalid signature' });
                return;
            }
            // Process common events
            const event = payload.event || payload.payload?.event || '';
            if (event.includes('payment.captured') || event.includes('payment.authorized')) {
                const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment?.entity || {};
                const orderId = paymentEntity.order_id;
                const paymentId = paymentEntity.id;
                const payment = await payment_repo_1.paymentRepository.getPaymentByOrderId(orderId);
                if (payment) {
                    await payment_repo_1.paymentRepository.updatePaymentStatus(paymentId, 'SUCCESS');
                    // update billing
                    if (payment.outletId) {
                        await billing_repo_1.billingRepository.updatePaidUntil(payment.outletId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
                    }
                }
                // Audit log: webhook processed and payment updated
                await audit_repo_1.auditRepository.createAuditLog({
                    action: 'PAYMENT_WEBHOOK_PROCESSED',
                    entity: 'Payment',
                    entityId: payment?.id || null,
                    userId: payment?.userId || null,
                    details: JSON.stringify({ event }),
                });
            }
            res.status(200).json({ ok: true });
        }
        catch (err) {
            logger_1.logger.error('Webhook processing failed', err);
            res.status(500).json({ error: 'Failed to process webhook' });
        }
    }
}
exports.PaymentController = PaymentController;
exports.paymentController = new PaymentController();
//# sourceMappingURL=payment.controller.js.map