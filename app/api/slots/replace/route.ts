import { NextRequest, NextResponse } from 'next/server'
import { saveSlots } from '@/lib/data'
import { getSession } from '@/lib/auth'
import { newId } from '@/lib/utils'
import type { RecurringSlot } from '@/lib/types'

export async function POST(req: NextRequest) {
  if (!(await getSession())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body: Omit<RecurringSlot, 'id'>[] = await req.json()
  const slots: RecurringSlot[] = body.map(s => ({ ...s, id: newId() }))
  await saveSlots(slots)
  return NextResponse.json({ ok: true, count: slots.length })
}
