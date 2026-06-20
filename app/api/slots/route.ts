import { NextRequest, NextResponse } from 'next/server'
import { getSlots, saveSlots } from '@/lib/data'
import { checkAuth } from '@/lib/auth'
import { newId } from '@/lib/utils'
import type { RecurringSlot } from '@/lib/types'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getSlots())
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const slots = await getSlots()
  const slot: RecurringSlot = { ...body, id: newId(), active: true }
  slots.push(slot)
  await saveSlots(slots)
  return NextResponse.json(slot, { status: 201 })
}
