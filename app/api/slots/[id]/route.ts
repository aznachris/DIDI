import { NextRequest, NextResponse } from 'next/server'
import { getSlots, saveSlots } from '@/lib/data'
import { checkAuth } from '@/lib/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const slots = await getSlots()
  const idx = slots.findIndex(s => s.id === id)
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  slots[idx] = { ...slots[idx], ...body }
  await saveSlots(slots)
  return NextResponse.json(slots[idx])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const slots = await getSlots()
  await saveSlots(slots.filter(s => s.id !== id))
  return NextResponse.json({ ok: true })
}
