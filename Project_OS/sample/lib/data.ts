import { prisma } from './db'

export async function getStats(userId: string) {
  const userCount = await prisma.user.count()
  return { userCount, revenue: 12500, activePlans: 42 }
}

export async function fetchPosts() {
  return prisma.post.findMany({ orderBy: { createdAt: 'desc' }, take: 20 })
}

export async function fetchPostBySlug(slug: string) {
  return prisma.post.findUnique({ where: { slug } })
}

export async function fetchAnalytics() {
  return {
    users: await prisma.user.count(),
    revenue: 45200,
    posts: await prisma.post.count(),
    timeSeries: [],
  }
}

export async function fetchAllUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: 'desc' } })
}
