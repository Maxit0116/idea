import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const [users, posts] = await Promise.all([
    db.user.findMany({ where: { name: { contains: q } }, take: 5 }),
    db.post.findMany({ where: { title: { contains: q } }, take: 10 }),
  ])
  return Response.json({ users, posts })
}
