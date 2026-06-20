import { NextRequest, NextResponse } from 'next/server'
import { getStudents, saveStudents } from '@/lib/data'
import { checkAuth } from '@/lib/auth'
import { newId } from '@/lib/utils'
import { geocodeAddress } from '@/lib/geocode'
import type { Student } from '@/lib/types'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await getStudents())
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const coords = await geocodeAddress(body.address)
  const student: Student = {
    ...body,
    id: newId(),
    createdAt: new Date().toISOString(),
    active: true,
    preferred: body.preferred ?? [],
    unavailable: body.unavailable ?? [],
    lat: coords?.lat,
    lng: coords?.lng,
  }
  const students = await getStudents()
  students.push(student)
  await saveStudents(students)
  return NextResponse.json(student, { status: 201 })
}
