import type { Student, DayOfWeek, ProposedSlot, DidiBlock } from './types'
import { timeToMinutes, minutesToTime } from './utils'

// ── Config ────────────────────────────────────────────────
const DAYS: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_START = 8 * 60   // 8:00
const DAY_END   = 22 * 60  // 22:00
const AVG_SPEED_KMH = 20
const MIN_TRAVEL_MINS = 10

// Didi's home — starting point of every day's route
// Default: Κεφαληνίας / Ζακύνθου, Κυψέλη Athens
export const DIDI_HOME = { lat: 37.9928, lng: 23.7358 }

// ── Geo ──────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

function travelMins(dist: number): number {
  return Math.max(MIN_TRAVEL_MINS, Math.ceil((dist / AVG_SPEED_KMH) * 60))
}

function distToHome(s: Student): number {
  if (!s.lat || !s.lng) return 0
  return haversineKm(DIDI_HOME.lat, DIDI_HOME.lng, s.lat, s.lng)
}

function distBetween(a: Student, b: Student): number {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return 0
  return haversineKm(a.lat, a.lng, b.lat, b.lng)
}

// ── Time window helpers ───────────────────────────────────
function isHardUnavailable(s: Student, day: DayOfWeek, from: number, to: number): boolean {
  return s.unavailable.some(w =>
    w.day === day &&
    timeToMinutes(w.from) < to &&
    timeToMinutes(w.to) > from
  )
}

function preferredWindowFor(s: Student, day: DayOfWeek): { from: number; to: number } | null {
  const w = s.preferred.find(p => p.day === day)
  if (!w) return null
  return { from: timeToMinutes(w.from), to: timeToMinutes(w.to) }
}

function earliestStart(s: Student, day: DayOfWeek, notBefore: number): number {
  const pref = preferredWindowFor(s, day)
  const base = pref ? Math.max(notBefore, pref.from) : notBefore
  return base
}

function latestStart(s: Student, day: DayOfWeek, dur: number): number {
  const pref = preferredWindowFor(s, day)
  return pref ? pref.to - dur : DAY_END - dur
}

function conflictsWithDidi(blocks: DidiBlock[], day: DayOfWeek, from: number, to: number): boolean {
  return blocks.some(b =>
    b.day === day &&
    timeToMinutes(b.from) < to &&
    timeToMinutes(b.to) > from
  )
}

// ── Phase 1: Assign students to days ─────────────────────
// Returns map: studentId → day[]  (one entry per session)
interface SessionAssignment { studentId: string; day: DayOfWeek; dur: number }

function assignDays(students: Student[], didiBlocks: DidiBlock[]): SessionAssignment[] {
  const assignments: SessionAssignment[] = []

  // Sort: most constrained (fewest valid days) first
  const sorted = [...students].sort((a, b) => {
    const aDays = DAYS.filter(d => !isHardUnavailable(a, d, DAY_START, DAY_END)).length
    const bDays = DAYS.filter(d => !isHardUnavailable(b, d, DAY_START, DAY_END)).length
    return aDays - bDays
  })

  for (const student of sorted) {
    const needed = student.sessionsPerWeek
    const dur = student.sessionDurationMins
    let placed = 0

    // Try each session
    for (let session = 0; session < needed; session++) {
      const alreadyUsedDays = assignments
        .filter(a => a.studentId === student.id)
        .map(a => a.day)

      let bestDay: DayOfWeek | null = null
      let bestScore = -Infinity

      for (const day of DAYS) {
        if (alreadyUsedDays.includes(day)) continue
        if (isHardUnavailable(student, day, DAY_START, DAY_END)) continue
        if (conflictsWithDidi(didiBlocks, day, DAY_START, DAY_END)) continue

        const dayAssignments = assignments.filter(a => a.day === day)

        let score = 0

        // Preferred day bonus
        if (student.preferred.some(p => p.day === day)) score += 20

        // Geographic clustering: how close is this student to others already on this day?
        if (dayAssignments.length > 0) {
          const assignedStudents = dayAssignments.map(a =>
            students.find(s => s.id === a.studentId)!
          ).filter(Boolean)
          const avgDist = assignedStudents.reduce((sum, s) => {
            return sum + distBetween(student, s)
          }, 0) / assignedStudents.length
          score += Math.max(0, 15 - avgDist * 3) // closer = +15, far = 0
        }

        // Slight preference for days with fewer total sessions (balance the week)
        score -= dayAssignments.length * 2

        if (score > bestScore) {
          bestScore = score
          bestDay = day
        }
      }

      if (bestDay) {
        assignments.push({ studentId: student.id, day: bestDay, dur })
        placed++
      }
    }
  }

  return assignments
}

// ── Phase 2: TSP per day — nearest-neighbor from Didi's home ──
interface DaySession {
  student: Student
  dur: number
}

interface RoutedSlot {
  student: Student
  day: DayOfWeek
  startMins: number
  durationMins: number
  warnings: string[]
}

function routeDay(day: DayOfWeek, sessions: DaySession[], didiBlocks: DidiBlock[]): RoutedSlot[] {
  if (sessions.length === 0) return []

  const n = sessions.length
  const visited = new Array(n).fill(false)
  const route: RoutedSlot[] = []

  let curLat = DIDI_HOME.lat
  let curLng = DIDI_HOME.lng
  let curTime = DAY_START

  for (let step = 0; step < n; step++) {
    let bestIdx = -1
    let bestCost = Infinity
    let bestStart = 0

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue
      const { student, dur } = sessions[i]

      // Travel time from current position
      const dist = (student.lat && student.lng)
        ? haversineKm(curLat, curLng, student.lat, student.lng)
        : distToHome(student)
      const travel = travelMins(dist)
      const arrival = curTime + travel

      // Earliest we can start (respects preferred window)
      const earliest = earliestStart(student, day, arrival)
      const latest = latestStart(student, day, dur)

      // Hard unavailability check
      if (isHardUnavailable(student, day, earliest, earliest + dur)) continue
      if (earliest > latest) continue
      if (earliest + dur > DAY_END) continue

      // Didi blocks check
      if (conflictsWithDidi(didiBlocks, day, earliest, earliest + dur)) continue

      // Cost = earliest start time (primary) + distance as tiebreak
      // This ensures students with early windows go first, avoiding being locked out later
      // 1 km ≈ 3 min at 20km/h → convert dist to "time equivalent" for fair comparison
      const cost = earliest * 10 + dist * 3
      if (cost < bestCost) {
        bestCost = cost
        bestIdx = i
        bestStart = earliest
      }
    }

    if (bestIdx === -1) break

    const { student, dur } = sessions[bestIdx]
    visited[bestIdx] = true

    const warnings: string[] = []
    const pref = preferredWindowFor(student, day)
    if (pref && (bestStart < pref.from || bestStart + dur > pref.to)) {
      warnings.push('Εκτός προτιμώμενης ώρας')
    }
    if (!pref && bestStart < 10 * 60) {
      warnings.push('Πρωινή ώρα — χωρίς προτίμηση για αυτή την ημέρα')
    }

    route.push({ student, day, startMins: bestStart, durationMins: dur, warnings })

    curLat = student.lat ?? curLat
    curLng = student.lng ?? curLng
    curTime = bestStart + dur
  }

  return route
}

// ── Main export ───────────────────────────────────────────
export function generateSchedule(students: Student[], didiBlocks: DidiBlock[]): ProposedSlot[] {
  const active = students.filter(s => s.active && s.sessionsPerWeek > 0 && s.sessionDurationMins > 0)
  if (active.length === 0) return []

  // Phase 1: assign each session to a day
  const assignments = assignDays(active, didiBlocks)

  // Phase 2: for each day, order the sessions optimally (TSP nearest-neighbor from home)
  const results: ProposedSlot[] = []

  for (const day of DAYS) {
    const daySessions: DaySession[] = assignments
      .filter(a => a.day === day)
      .map(a => ({
        student: active.find(s => s.id === a.studentId)!,
        dur: a.dur,
      }))
      .filter(ds => ds.student != null)

    const routed = routeDay(day, daySessions, didiBlocks)

    for (const slot of routed) {
      results.push({
        studentId: slot.student.id,
        day: slot.day,
        startTime: minutesToTime(slot.startMins),
        durationMins: slot.durationMins,
        score: 0,
        warnings: slot.warnings,
      })
    }
  }

  return results
}

// ── Travel time util (for UI display) ────────────────────
export function travelTimeBetween(
  a: { lat?: number; lng?: number },
  b: { lat?: number; lng?: number }
): number | null {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return null
  return travelMins(haversineKm(a.lat, a.lng, b.lat, b.lng))
}
