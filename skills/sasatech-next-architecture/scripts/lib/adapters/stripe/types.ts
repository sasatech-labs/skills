// ========================================
// 入力型
// ========================================

export interface CreatePaymentIntentInput {
  amount: number
  currency?: string
  customerId?: string
  metadata?: Record<string, string>
}

export interface CreateCustomerInput {
  email: string
  name?: string
  metadata?: Record<string, string>
}

export interface CreateCheckoutSessionInput {
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

export interface PaymentIntent {
  id: string
  amount: number
  currency: string
  status: string
  clientSecret: string
}

export interface Customer {
  id: string
  email: string
  name: string | null
}

export interface CheckoutSession {
  id: string
  url: string
}

export interface Subscription {
  id: string
  status: string
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
}
