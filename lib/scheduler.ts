import type { Student, DayOfWeek, ProposedSlot, DidiBlock, TimeWindow } from './types'
import { timeToMinutes, minutesToTime } from './utils'

const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_START = 8 * 60   // 8:00
const DAY_END   = 22 * 60  // 22:00
const GRID_STEP = 30       // 30-min granularity

const AVG_SPEED_KMH = 20
const MIN_TRAVEL_MINS = 10

// ── Geo ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function travelMins(dist: number): number {
  return Math.max(MIN_TRAVEL_MINS, Math.ceil((dist / AVG_SPEED_KMH) * 60))
}

// ── Time helpers ─────────────────────────────────────────
function windowsOverlap(aFrom: number, aTo: number, bFrom: number, bTo: number): boolean {
  return aFrom < bTo && bFrom < aTo
}

function isHardUnavailable(student: Student, day: DayOfWeek, startMins: number, endMins: number): boolean {
  return student.unavailable.some(
    w => w.day === day && windowsOverlap(startMins, endMins, timeToMinutes(w.from), timeToMinutes(w.to))
  )
}

function isPreferred(student: Student, day: DayOfWeek, startMins: number, endMins: number): boolean {
  return student.preferred.some(
    w => w.day === day && windowsOverlap(startMins, endMins, timeToMinutes(w.from), timeToMinutes(w.to))
  )
}

function conflictsWithDidiBlock(blocks: DidiBlock[], day: DayOfWeek, startMins: number, endMins: number): boolean {
  return blocks.some(
    b => b.day === day && windowsOverlap(startMins, endMins, timeToMinutes(b.from), timeToMinutes(b.to))
  )
}

// Check if a proposed slot conflicts with already-placed slots (including travel time)
function conflictsWithPlaced(
  placed: InternalSlot[],
  student: Student,
  day: DayOfWeek,
  startMins: number,
  endMins: number
): { conflict: boolean; travelWarning?: string } {
  const daySlots = placed.filter(p => p.day === day).sort((a, b) => a.startMins - b.startMins)

  for (const existing of daySlots) {
    // Hard overlap
    if (windowsOverlap(startMins, endMins, existing.startMins, existing.endMins)) {
      return { conflict: true }
    }

    // Travel time check
    const dist = (existing.lat && existing.lng && student.lat && student.lng)
      ? haversineKm(existing.lat, existing.lng, student.lat, student.lng)
      : 0
    const travel = dist > 0 ? travelMins(dist) : MIN_TRAVEL_MINS

    // Slot comes after existing: need gap
    if (startMins >= existing.endMins && startMins < existing.endMins + travel) {
      return { conflict: true }
    }
    // Slot comes before existing: need gap
    if (endMins <= existing.startMins && endMins + travel > existing.startMins) {
      return { conflict: true }
    }
  }
  return { conflict: false }
}

// ── Scoring ───────────────────────────────────────────────
function scoreSlot(
  student: Student,
  day: DayOfWeek,
  startMins: number,
  endMins: number,
  placed: InternalSlot[],
  sessionIndexForStudent: number // how many sessions of this student already placed
): number {
  let score = 0

  // Preferred time bonus
  if (isPreferred(student, day, startMins, endMins)) score += 20

  // Spread sessions across different days (penalty for same day as existing session of same student)
  const studentDays = placed.filter(p => p.studentId === student.id).map(p => p.day)
  if (studentDays.includes(day)) score -= 15

  const daySlots = placed.filter(p => p.day === day)

  if (daySlots.length === 0) {
    // No one on this day yet — neutral
    score += 0
  } else {
    // Proximity bonus: prefer to be near others on same day
    const closestDist = Math.min(
      ...daySlots.map(p => {
        if (!p.lat || !p.lng || !student.lat || !student.lng) return 5 // unknown → assume medium
        return haversineKm(p.lat, p.lng, student.lat, student.lng)
      })
    )
    // Closer = higher score (max 15 pts at 0km, 0 pts at 5km+)
    score += Math.max(0, 15 - closestDist * 3)
  }

  // Slight preference for earlier in the day (morning lessons allow more flexibility)
  score -= (startMins - DAY_START) / 60 * 0.5

  return score
}

// ── Internal types ────────────────────────────────────────
interface InternalSlot {
  studentId: string
  day: DayOfWeek
  startMins: number
  endMins: number
  durationMins: number
  lat?: number
  lng?: number
  score: number
}

// ── Main algorithm ────────────────────────────────────────
export function generateSchedule(
  students: Student[],
  didiBlocks: DidiBlock[]
): ProposedSlot[] {
  const active = students.filter(s => s.active && s.sessionsPerWeek > 0)

  // Most constrained first: fewer valid time windows = schedule first
  const sorted = [...active].sort((a, b) => {
    const aSlots = countValidSlots(a, didiBlocks)
    const bSlots = countValidSlots(b, didiBlocks)
    return aSlots - bSlots
  })

  const placed: InternalSlot[] = []

  for (const student of sorted) {
    for (let session = 0; session < student.sessionsPerWeek; session++) {
      const best = findBestSlot(student, placed, didiBlocks, session)
      if (best) placed.push(best)
    }
  }

  return placed.map(p => ({
    studentId: p.studentId,
    day: p.day,
    startTime: minutesToTime(p.startMins),
    durationMins: p.durationMins,
    score: p.score,
    warnings: computeWarnings(p, placed, students),
  }))
}

function countValidSlots(student: Student, didiBlocks: DidiBlock[]): number {
  let count = 0
  for (const day of DAYS) {
    for (let t = DAY_START; t + student.sessionDurationMins <= DAY_END; t += GRID_STEP) {
      if (!isHardUnavailable(student, day, t, t + student.sessionDurationMins) &&
          !conflictsWithDidiBlock(didiBlocks, day, t, t + student.sessionDurationMins)) {
        count++
      }
    }
  }
  return count
}

function findBestSlot(
  student: Student,
  placed: InternalSlot[],
  didiBlocks: DidiBlock[],
  sessionIndex: number
): InternalSlot | null {
  const dur = student.sessionDurationMins
  let bestScore = -Infinity
  let bestSlot: InternalSlot | null = null

  for (const day of DAYS) {
    for (let t = DAY_START; t + dur <= DAY_END; t += GRID_STEP) {
      const endMins = t + dur
      if (isHardUnavailable(student, day, t, endMins)) continue
      if (conflictsWithDidiBlock(didiBlocks, day, t, endMins)) continue
      const { conflict } = conflictsWithPlaced(placed, student, day, t, endMins)
      if (conflict) continue

      const score = scoreSlot(student, day, t, endMins, placed, sessionIndex)
      if (score > bestScore) {
        bestScore = score
        bestSlot = {
          studentId: student.id,
          day,
          startMins: t,
          endMins,
          durationMins: dur,
          lat: student.lat,
          lng: student.lng,
          score,
        }
      }
    }
  }
  return bestSlot
}

function computeWarnings(slot: InternalSlot, placed: InternalSlot[], students: Student[]): string[] {
  const warnings: string[] = []
  const student = students.find(s => s.id === slot.studentId)
  if (!student) return warnings

  if (!isPreferred(student, slot.day, slot.startMins, slot.endMins) && student.preferred.length > 0) {
    warnings.push('Εκτός προτιμώμενων ωρών')
  }

  // Check travel time to adjacent lessons
  const daySlots = placed
    .filter(p => p.day === slot.day && p.studentId !== slot.studentId)
    .sort((a, b) => a.startMins - b.startMins)

  for (const other of daySlots) {
    if (!other.lat || !other.lng || !student.lat || !student.lng) continue
    const dist = haversineKm(other.lat, other.lng, student.lat, student.lng)
    const travel = travelMins(dist)

    const gap1 = slot.startMins - other.endMins
    const gap2 = other.startMins - slot.endMins

    if ((gap1 > 0 && gap1 < travel) || (gap2 > 0 && gap2 < travel)) {
      warnings.push(`Μικρό χρονικό περιθώριο μετακίνησης (~${travel} λεπτά)`)
    }
  }

  return warnings
}

// ── Travel time between two consecutive slots (for UI) ────
export function travelTimeBetween(
  a: { lat?: number; lng?: number },
  b: { lat?: number; lng?: number }
): number | null {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return null
  const dist = haversineKm(a.lat, a.lng, b.lat, b.lng)
  return travelMins(dist)
}
