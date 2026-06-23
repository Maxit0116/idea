import { NextRequest, NextResponse } from 'next/server'
import { verifyCredentials, createSession } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const user = await verifyCredentials(email, password)
  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const session = await createSession(user.id)
  return NextResponse.json({ token: session.token, userId: user.id })
}

export async function DELETE() {
  return NextResponse.json({ success: true })
}
