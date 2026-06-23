import { db } from '@/lib/db'

interface PaymentInput {
  userId: string
  planId: string
  paymentMethod: string
}

export async function processPayment(input: PaymentInput) {
  const subscription = await db.subscription.create({
    data: {
      userId: input.userId,
      planId: input.planId,
      status: 'active',
      startDate: new Date(),
    },
  })
  return { success: true, subscriptionId: subscription.id }
}

export async function cancelSubscription(subscriptionId: string) {
  await db.subscription.update({
    where: { id: subscriptionId },
    data: { status: 'cancelled', endDate: new Date() },
  })
}
