import { NextRequest, NextResponse } from 'next/server'
import { getLessons } from '@/lib/data'
import { checkAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  return NextResponse.json(await getLessons(month))
}
