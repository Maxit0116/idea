import { db } from '@/lib/db'
import { validateToken } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await validateToken(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const notifications = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(notifications)
}

export async function PATCH(request: Request) {
  const user = await validateToken(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  await db.notification.updateMany({ where: { userId: user.id }, data: { read: true } })
  return Response.json({ success: true })
}
