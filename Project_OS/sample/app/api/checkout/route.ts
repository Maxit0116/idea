import { validateToken } from '@/lib/auth'
import { processPayment } from '@/lib/payments'

export async function POST(request: Request) {
  const user = await validateToken(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const { planId, paymentMethod } = await request.json()
  const result = await processPayment({ userId: user.id, planId, paymentMethod })
  return Response.json(result)
}
