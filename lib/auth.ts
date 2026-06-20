import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'didi_session'
const SESSION_VALUE = 'authenticated'

export async function verifyPassword(password: string): Promise<boolean> {
  const stored = process.env.AUTH_PASSWORD
  if (!stored) return false
  return password === stored
}

// For Server Components
export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE)?.value === SESSION_VALUE
}

// For Route Handlers — reads directly from the request object (reliable in Next.js 16)
export function checkAuth(req: NextRequest): boolean {
  return req.cookies.get(SESSION_COOKIE)?.value === SESSION_VALUE
}
