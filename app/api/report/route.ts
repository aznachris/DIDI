import { NextRequest, NextResponse } from 'next/server'
import { getLessons } from '@/lib/data'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const month = req.nextUrl.searchParams.get('month') ?? new Date().toISOString().slice(0, 7)
  const lessons = await getLessons(month)
  return NextResponse.json(lessons)
}
