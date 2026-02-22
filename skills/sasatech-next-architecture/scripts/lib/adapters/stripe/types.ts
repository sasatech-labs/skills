// ========================================
// 入力型
// ========================================

interface _CreatePaymentIntentInput {
  amount: number
  currency?: string
  customerId?: string
  metadata?: Record<string, string>
}

interface _CreateCustomerInput {
  email: string
  name?: string
  metadata?: Record<string, string>
}

interface _CreateCheckoutSessionInput {
  customerId?: string
  priceId: string
  quantity?: number
  successUrl: string
  cancelUrl: string
  metadata?: Record<string, string>
}

// ========================================
// 出力型
// ========================================

interface _PaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  clientSecret: string
}

interface _Customer {
  id: string
  email: string
  name: string | null
}

interface _CheckoutSession {
  id: string
  url: string
}

interface _Subscription {
  id: string
  status: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}

export type CreatePaymentIntentInput = _CreatePaymentIntentInput
export type CreateCustomerInput = _CreateCustomerInput
export type CreateCheckoutSessionInput = _CreateCheckoutSessionInput
export type PaymentIntent = _PaymentIntent
export type Customer = _Customer
export type CheckoutSession = _CheckoutSession
export type Subscription = _Subscription
