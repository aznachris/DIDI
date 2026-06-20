import { NextRequest, NextResponse } from 'next/server'
import { getStudents, saveStudents } from '@/lib/data'
import { checkAuth } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const students = await getStudents()
  let updated = 0
  for (const student of students) {
    if (student.lat && student.lng) continue
    const coords = await geocodeAddress(student.address)
    if (coords) { student.lat = coords.lat; student.lng = coords.lng; updated++ }
    await new Promise(r => setTimeout(r, 1100))
  }
  await saveStudents(students)
  return NextResponse.json({ ok: true, updated })
}
