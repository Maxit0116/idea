import { db } from '@/lib/db'
import { validateToken } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await validateToken(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const settings = await db.settings.findUnique({ where: { userId: user.id } })
  return Response.json(settings)
}

export async function PUT(request: Request) {
  const user = await validateToken(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const settings = await db.settings.upsert({
    where: { userId: user.id },
    update: body,
    create: { userId: user.id, ...body },
  })
  return Response.json(settings)
}
