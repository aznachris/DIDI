import { NextRequest, NextResponse } from 'next/server'
import { getLessons, saveLessons } from '@/lib/data'
import { checkAuth } from '@/lib/auth'
import type { LessonStatus } from '@/lib/types'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body: { status?: LessonStatus; amountCharged?: number; notes?: string; date: string } = await req.json()
  const ym = body.date.slice(0, 7)
  const lessons = await getLessons(ym)
  const idx = lessons.findIndex(l => l.id === id)
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  lessons[idx] = { ...lessons[idx], ...body }
  await saveLessons(ym, lessons)
  return NextResponse.json(lessons[idx])
}
