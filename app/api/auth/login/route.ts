import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { password } = await req.json()
  const valid = await verifyPassword(password)
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('didi_session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  })
  return res
}
