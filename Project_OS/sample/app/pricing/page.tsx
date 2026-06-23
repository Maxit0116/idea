import { PricingCard } from '@/components/PricingCard'
import { PLANS } from '@/lib/constants'

export const metadata = { title: 'Pricing' }

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <h1>Choose Your Plan</h1>
      <div className="plans-grid">
        {PLANS.map((plan) => (
          <PricingCard key={plan.id} plan={plan} />
        ))}
      </div>
    </main>
  )
}
