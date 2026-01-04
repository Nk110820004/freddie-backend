import type { Response, Request } from "express"
import { paymentRepository } from "../repository/payment.repo"
import { billingRepository } from "../repository/billing.repo"
import { logger } from "../utils/logger"
import { auditRepository } from "../repository/audit.repo"
import type { AuthRequest } from "../middleware/auth.middleware"
import crypto from "crypto"

// In production, use environment variables
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || ""
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || ""

export class PaymentController {
  async createOrder(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { outletId, planType, amount } = req.body
      const userId = req.userId

      if (!outletId || !planType || !amount) {
        res.status(400).json({
          error: "outletId, planType, and amount are required",
        })
        return
      }

      // Create Razorpay order (implement actual Razorpay API call when needed)
      const razorpayOrderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' })
        return
      }

      const payment = await paymentRepository.createPayment({
        razorpayOrderId,
        amount,
        planType,
        userId,
        outletId,
      })

      logger.info(`Payment order created: ${razorpayOrderId}`, {
        outletId,
        planType,
        amount,
      })

      res.status(201).json({
        message: "Order created",
        orderId: razorpayOrderId,
        payment: {
          id: payment.id,
          razorpayOrderId: payment.razorpayOrderId,
          amount: payment.amount,
          currency: payment.currency,
        },
      })

      // Audit log: order created
      await auditRepository.createAuditLog({
        action: 'PAYMENT_ORDER_CREATED',
        entity: 'Payment',
        entityId: payment.id,
        userId: userId || null,
        details: JSON.stringify({ outletId, planType, amount }),
      })
    } catch (error) {
      logger.error("Failed to create payment order", error)
      res.status(500).json({ error: "Failed to create order" })
    }
  }

  async verifyPayment(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, outletId } = req.body

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          error: "razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
        })
        return
      }

      // Verify signature
      const body = `${razorpay_order_id}|${razorpay_payment_id}`
      const expectedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex")

      if (expectedSignature !== razorpay_signature) {
        res.status(400).json({ error: "Invalid signature" })
        return
      }

      // Get existing payment
      const payment = await paymentRepository.getPaymentByOrderId(razorpay_order_id)

      if (!payment) {
        res.status(404).json({ error: "Payment not found" })
        return
      }

      // Update payment with Razorpay payment ID and mark as successful
      const updatedPayment = await paymentRepository.updatePaymentStatus(razorpay_payment_id, "SUCCESS")

      // Update billing status if payment successful
      if (updatedPayment && outletId) {
        await billingRepository.updatePaidUntil(outletId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
      }

      logger.info(`Payment verified: ${razorpay_payment_id}`, {
        orderId: razorpay_order_id,
      })

      // Audit log: payment verified
      await auditRepository.createAuditLog({
        action: 'PAYMENT_VERIFIED',
        entity: 'Payment',
        entityId: updatedPayment?.id || null,
        userId: req.userId || null,
        details: JSON.stringify({ razorpay_order_id, razorpay_payment_id }),
      })

      res.status(200).json({
        message: "Payment verified successfully",
        payment: {
          id: payment.id,
          status: "SUCCESS",
        },
      })
    } catch (error) {
      logger.error("Failed to verify payment", error)
      res.status(500).json({ error: "Failed to verify payment" })
    }
  }

  async webhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = (req.headers['x-razorpay-signature'] as string) || req.headers['x-razorpay-signature']
      const payload = req.body

      const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ''
      if (!secret) {
        res.status(500).json({ error: 'Webhook secret not configured' })
        return
      }

      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
      const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex')

      if (expected !== signature) {
        logger.warn('Invalid razorpay webhook signature', { expected, signature })
        res.status(400).json({ error: 'Invalid signature' })
        return
      }

      // Process common events
      const event = payload.event || payload.payload?.event || ''

      if (event.includes('payment.captured') || event.includes('payment.authorized')) {
        const paymentEntity = payload.payload?.payment?.entity || payload.payload?.payment?.entity || {}
        const orderId = paymentEntity.order_id
        const paymentId = paymentEntity.id

        const payment = await paymentRepository.getPaymentByOrderId(orderId)
        if (payment) {
          await paymentRepository.updatePaymentStatus(paymentId, 'SUCCESS')
          // update billing
          if (payment.outletId) {
            await billingRepository.updatePaidUntil(payment.outletId, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
          }
        }

        // Audit log: webhook processed and payment updated
        await auditRepository.createAuditLog({
          action: 'PAYMENT_WEBHOOK_PROCESSED',
          entity: 'Payment',
          entityId: payment?.id || null,
          userId: payment?.userId || null,
          details: JSON.stringify({ event }),
        })
      }

      res.status(200).json({ ok: true })
    } catch (err) {
      logger.error('Webhook processing failed', err)
      res.status(500).json({ error: 'Failed to process webhook' })
    }
  }
}

export const paymentController = new PaymentController()
