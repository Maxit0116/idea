import { prisma } from './db'

interface Session {
  userId: string
  token: string
}

interface User {
  id: string
  name: string
  email: string
  role: string
}

export async function getSession(): Promise<Session | null> {
  return { userId: 'user_1', token: 'mock-token' }
}

export async function getCurrentUser(): Promise<User> {
  return { id: 'user_1', name: 'Demo User', email: 'demo@example.com', role: 'admin' }
}

export async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser()
  if (user.role !== 'admin') throw new Error('Unauthorized')
}

export async function validateToken(request: Request): Promise<User | null> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  return getCurrentUser()
}

export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) return null
  return user
}

export async function createSession(userId: string): Promise<Session> {
  return { userId, token: `session_${Date.now()}` }
}
