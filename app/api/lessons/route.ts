import { NextRequest, NextResponse } from 'next/server'
import { getLessons, saveLessons } from '@/lib/data'
import { getSession } from '@/lib/auth'
import { newId } from '@/lib/utils'
import type { Lesson } from '@/lib/types'

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const ym: string = body.date.slice(0, 7)
  const lessons = await getLessons(ym)
  const lesson: Lesson = {
    ...body,
    id: newId(),
    createdAt: new Date().toISOString(),
    status: 'scheduled',
  }
  lessons.push(lesson)
  await saveLessons(ym, lessons)
  return NextResponse.json(lesson, { status: 201 })
}
