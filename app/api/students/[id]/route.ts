import { NextRequest, NextResponse } from 'next/server'
import { getStudents, saveStudents } from '@/lib/data'
import { checkAuth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const body = await req.json()
  const students = await getStudents()
  const idx = students.findIndex(s => s.id === id)
  if (idx < 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const existing = students[idx]
  let lat = existing.lat
  let lng = existing.lng
  if (body.address && body.address !== existing.address) {
    const coords = await geocodeAddress(body.address)
    if (coords) { lat = coords.lat; lng = coords.lng }
  }
  students[idx] = { ...existing, ...body, lat, lng }
  await saveStudents(students)
  return NextResponse.json(students[idx])
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const students = await getStudents()
  const filtered = students.filter(s => s.id !== id)
  if (filtered.length === students.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await saveStudents(filtered)
  return NextResponse.json({ ok: true })
}
