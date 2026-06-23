'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

export function CheckoutForm({ user, plan }: { user: any; plan: any }) {
  const [processing, setProcessing] = useState(false)

  async function handleCheckout() {
    setProcessing(true)
    await fetch('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ planId: plan.id, paymentMethod: 'card' }),
    })
    setProcessing(false)
  }

  return (
    <div className="checkout-form">
      <div className="checkout-summary">
        <h3>{plan.name}</h3>
        <p>{formatCurrency(plan.price)}/month</p>
      </div>
      <div className="checkout-user">
        <p>Billing to: {user.email}</p>
      </div>
      <button onClick={handleCheckout} disabled={processing}>
        {processing ? 'Processing...' : 'Confirm Payment'}
      </button>
    </div>
  )
}
