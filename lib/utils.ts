import type { DayOfWeek } from './types'

export function newId(): string {
  return crypto.randomUUID()
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'Δευτέρα',
  TUE: 'Τρίτη',
  WED: 'Τετάρτη',
  THU: 'Πέμπτη',
  FRI: 'Παρασκευή',
  SAT: 'Σάββατο',
  SUN: 'Κυριακή',
}

export const DAYS_ORDER: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

export const LEVEL_COLORS: Record<string, string> = {
  A1: 'bg-green-100 text-green-800',
  A2: 'bg-green-200 text-green-900',
  B1: 'bg-blue-100 text-blue-800',
  B2: 'bg-blue-200 text-blue-900',
  C1: 'bg-purple-100 text-purple-800',
  C2: 'bg-purple-200 text-purple-900',
}

export function formatMoney(amount: number): string {
  return `€${amount.toFixed(2)}`
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Returns lesson end time as "HH:mm"
export function lessonEndTime(startTime: string, durationMins: number): string {
  return minutesToTime(timeToMinutes(startTime) + durationMins)
}

// ISO date "YYYY-MM-DD" to js Date day of week → DayOfWeek
export function dateToDayOfWeek(dateStr: string): DayOfWeek {
  const d = new Date(dateStr + 'T00:00:00')
  const map: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  return map[d.getDay()]
}

// Week start (Monday) for a given date string
export function weekStart(dateStr: string): Date {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return isoDate(d)
}
