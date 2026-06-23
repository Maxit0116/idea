import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function getUserById(id: string) {
  return prisma.user.findUnique({ where: { id } })
}

export async function getUserSettings(userId: string) {
  return { emailNotifications: true, theme: 'dark' }
}

export async function getAllUsers() {
  return prisma.user.findMany()
}

export async function createUser(data: { name: string; email: string }) {
  return prisma.user.create({ data })
}
