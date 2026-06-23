import { CheckoutForm } from '@/components/CheckoutForm'
import { getCurrentUser } from '@/lib/auth'
import { PLANS } from '@/lib/constants'

export const metadata = { title: 'Checkout' }

export default async function CheckoutPage({ searchParams }: { searchParams: { plan?: string } }) {
  const user = await getCurrentUser()
  const plan = PLANS.find((p) => p.id === searchParams.plan) || PLANS[0]
  return (
    <main className="checkout-page">
      <h1>Complete Your Purchase</h1>
      <CheckoutForm user={user} plan={plan} />
    </main>
  )
}
