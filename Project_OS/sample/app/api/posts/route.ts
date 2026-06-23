import { db } from '@/lib/db'
import { validateToken } from '@/lib/auth'

export async function GET() {
  const posts = await db.post.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
  return Response.json(posts)
}

export async function POST(request: Request) {
  const user = await validateToken(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const post = await db.post.create({ data: { ...body, authorId: user.id } })
  return Response.json(post, { status: 201 })
}
