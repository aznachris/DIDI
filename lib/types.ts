export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type AgeGroup = 'kid' | 'teen' | 'adult'
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'
export type LessonStatus = 'scheduled' | 'done' | 'cancelled_student' | 'cancelled_didi'

export interface TimeWindow {
  day: DayOfWeek
  from: string // "HH:mm"
  to: string   // "HH:mm"
}

export interface Student {
  id: string
  name: string
  address: string
  lat?: number
  lng?: number
  ratePerHour: number
  level: Level
  ageGroup: AgeGroup
  notes?: string
  // Scheduling preferences
  preferred: TimeWindow[]    // soft: respect when possible
  unavailable: TimeWindow[]  // hard: never schedule here
  // Weekly schedule config
  sessionsPerWeek: number      // e.g. 2
  sessionDurationMins: number  // e.g. 60
  minDaysBetweenSessions: number // e.g. 2 — min calendar days between any two sessions
  createdAt: string
  active: boolean
}

export interface RecurringSlot {
  id: string
  studentId: string
  day: DayOfWeek
  startTime: string
  durationMins: number
  validFrom: string
  validUntil?: string
  active: boolean
}

export interface Lesson {
  id: string
  studentId: string
  recurringSlotId?: string
  date: string
  startTime: string
  durationMins: number
  status: LessonStatus
  amountCharged: number
  notes?: string
  createdAt: string
}

export interface DidiBlock {
  day: DayOfWeek
  from: string
  to: string
  label?: string
}

// For the schedule builder
export interface ProposedSlot {
  studentId: string
  day: DayOfWeek
  startTime: string
  durationMins: number
  score: number
  warnings: string[]
}

export interface StudentsBlob { students: Student[] }
export interface SlotsBlob { slots: RecurringSlot[] }
export interface LessonsBlob { lessons: Lesson[] }
export interface DidiBlocksBlob { blocks: DidiBlock[] }
