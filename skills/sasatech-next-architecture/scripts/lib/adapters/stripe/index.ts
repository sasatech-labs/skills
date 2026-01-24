import 'server-only'
import type Stripe from 'stripe'
import { stripe } from './client'
import { handleStripeError } from './errors'
import type {
  CreatePaymentIntentInput,
  CreateCustomerInput,
  CreateCheckoutSessionInput,
  PaymentIntent,
  Customer,
  CheckoutSession,
  Subscription,
} from './types'

export type { PaymentIntent, Customer, CheckoutSession, Subscription }
export type {
  CreatePaymentIntentInput,
  CreateCustomerInput,
  CreateCheckoutSessionInput,
}

export const stripeAdapter = {
  // ========================================
  // Payment Intent
  // ========================================

  /**
   * 決済インテントを作成
   */
  async createPaymentIntent(
    input: CreatePaymentIntentInput
  ): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.create({
        amount: input.amount,
        currency: input.currency ?? 'jpy',
        customer: input.customerId,
        metadata: input.metadata,
      })

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        clientSecret: intent.client_secret!,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  /**
   * 決済インテントを取得
   */
  async getPaymentIntent(paymentIntentId: string): Promise<PaymentIntent> {
    try {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId)

      return {
        id: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        status: intent.status,
        clientSecret: intent.client_secret!,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  // ========================================
  // Customer
  // ========================================

  /**
   * 顧客を作成
   */
  async createCustomer(input: CreateCustomerInput): Promise<Customer> {
    try {
      const customer = await stripe.customers.create({
        email: input.email,
        name: input.name,
        metadata: input.metadata,
      })

      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  /**
   * 顧客を取得
   */
  async getCustomer(customerId: string): Promise<Customer | null> {
    try {
      const customer = await stripe.customers.retrieve(customerId)

      if (customer.deleted) {
        return null
      }

      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  // ========================================
  // Checkout Session
  // ========================================

  /**
   * Checkout セッションを作成
   */
  async createCheckoutSession(
    input: CreateCheckoutSessionInput
  ): Promise<CheckoutSession> {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: input.customerId,
        line_items: [
          {
            price: input.priceId,
            quantity: input.quantity ?? 1,
          },
        ],
        mode: 'subscription',
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      })

      return {
        id: session.id,
        url: session.url!,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  // ========================================
  // Subscription
  // ========================================

  /**
   * サブスクリプションを取得
   */
  async getSubscription(subscriptionId: string): Promise<Subscription | null> {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  /**
   * サブスクリプションをキャンセル（期間終了時）
   */
  async cancelSubscriptionAtPeriodEnd(
    subscriptionId: string
  ): Promise<Subscription> {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      })

      return {
        id: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    } catch (error) {
      throw handleStripeError(error)
    }
  },

  // ========================================
  // Webhook
  // ========================================

  /**
   * Webhook イベントを構築・検証
   */
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string,
    webhookSecret?: string
  ): Stripe.Event {
    const secret = webhookSecret ?? process.env.STRIPE_WEBHOOK_SECRET

    if (!secret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined')
    }

    try {
      return stripe.webhooks.constructEvent(payload, signature, secret)
    } catch (error) {
      throw handleStripeError(error)
    }
  },
}
