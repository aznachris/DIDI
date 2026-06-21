'use client'

import { useState, useMemo } from 'react'
import type { Student, Lesson, RecurringSlot } from '@/lib/types'
import { formatMoney, addDays, DAYS_ORDER, dateToDayOfWeek } from '@/lib/utils'

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος',
  'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος',
  'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

interface EffectiveEntry {
  date: string
  studentId: string
  startTime: string
  durationMins: number
  status: 'done' | 'virtual' | 'cancelled_student' | 'cancelled_didi' | 'scheduled'
  amountCharged: number
  lessonId?: string
}

function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  const days: string[] = []
  const d = new Date(y, m - 1, 1)
  while (d.getMonth() === m - 1) {
    days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    d.setDate(d.getDate() + 1)
  }
  return days
}

function buildEntries(
  month: string,
  lessons: Lesson[],
  slots: RecurringSlot[],
  students: Student[],
): EffectiveEntry[] {
  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))
  const entries: EffectiveEntry[] = []
  const usedLessonIds = new Set<string>()

  for (const date of daysInMonth(month)) {
    const dayOfWeek = dateToDayOfWeek(date)

    for (const slot of slots) {
      if (!slot.active) continue
      if (slot.day !== dayOfWeek) continue
      if (date < slot.validFrom) continue
      if (slot.validUntil && date > slot.validUntil) continue

      const student = studentMap[slot.studentId]
      const defaultAmount = student
        ? Math.round(student.ratePerHour * slot.durationMins / 60 * 100) / 100
        : 0

      // Find matching real lesson
      const real = lessons.find(l =>
        l.date === date &&
        (l.recurringSlotId === slot.id ||
          (l.studentId === slot.studentId && l.startTime === slot.startTime))
      )

      if (real) {
        usedLessonIds.add(real.id)
        entries.push({
          date, studentId: slot.studentId,
          startTime: slot.startTime, durationMins: slot.durationMins,
          status: real.status as EffectiveEntry['status'],
          amountCharged: real.amountCharged,
          lessonId: real.id,
        })
      } else {
        // Virtual: counts as income by default
        entries.push({
          date, studentId: slot.studentId,
          startTime: slot.startTime, durationMins: slot.durationMins,
          status: 'virtual',
          amountCharged: defaultAmount,
        })
      }
    }

    // Include one-off lessons not linked to a slot (replacements, extra lessons)
    for (const l of lessons) {
      if (l.date !== date) continue
      if (usedLessonIds.has(l.id)) continue
      const student = studentMap[l.studentId]
      const defaultAmount = student
        ? Math.round(student.ratePerHour * l.durationMins / 60 * 100) / 100
        : l.amountCharged
      entries.push({
        date, studentId: l.studentId,
        startTime: l.startTime, durationMins: l.durationMins,
        status: l.status as EffectiveEntry['status'],
        amountCharged: l.status === 'done' || l.status === 'scheduled' ? defaultAmount : 0,
        lessonId: l.id,
      })
      usedLessonIds.add(l.id)
    }
  }

  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
}

interface Props {
  students: Student[]
  slots: RecurringSlot[]
  initialLessons: Lesson[]
  initialMonth: string
}

export default function ReportClient({ students, slots, initialLessons, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [lessons, setLessons] = useState(initialLessons)
  const [loading, setLoading] = useState(false)

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])

  async function changeMonth(newMonth: string) {
    setMonth(newMonth)
    setLoading(true)
    const res = await fetch(`/api/report?month=${newMonth}`, { credentials: 'include' })
    const data = await res.json()
    setLessons(data)
    setLoading(false)
  }

  function prevMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    changeMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  function nextMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m, 1)
    changeMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const entries = useMemo(
    () => buildEntries(month, lessons, slots, students),
    [month, lessons, slots, students]
  )

  const earned = entries
    .filter(e => e.status === 'done' || e.status === 'virtual' || e.status === 'scheduled')
    .reduce((s, e) => s + e.amountCharged, 0)

  const lost = entries
    .filter(e => e.status === 'cancelled_student' || e.status === 'cancelled_didi')
    .reduce((s, e) => {
      const student = studentMap[e.studentId]
      return s + (student ? Math.round(student.ratePerHour * e.durationMins / 60 * 100) / 100 : 0)
    }, 0)

  const totalSessions = entries.filter(e => e.status !== 'cancelled_student' && e.status !== 'cancelled_didi').length
  const cancelled = entries.filter(e => e.status === 'cancelled_student' || e.status === 'cancelled_didi').length

  // Per-student summary
  const perStudent = useMemo(() => {
    const map: Record<string, { sessions: number; cancelled: number; income: number; lost: number }> = {}
    for (const e of entries) {
      if (!map[e.studentId]) map[e.studentId] = { sessions: 0, cancelled: 0, income: 0, lost: 0 }
      const student = studentMap[e.studentId]
      const expectedAmount = student ? Math.round(student.ratePerHour * e.durationMins / 60 * 100) / 100 : 0
      if (e.status === 'cancelled_student' || e.status === 'cancelled_didi') {
        map[e.studentId].cancelled++
        map[e.studentId].lost += expectedAmount
      } else {
        map[e.studentId].sessions++
        map[e.studentId].income += e.amountCharged
      }
    }
    return Object.entries(map)
      .map(([studentId, s]) => ({ studentId, ...s }))
      .sort((a, b) => b.income - a.income)
  }, [entries, studentMap])

  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={prevMonth} className="text-gray-500 px-2 py-1 text-lg">‹</button>
        <h1 className="text-xl font-bold text-gray-800">{monthLabel}</h1>
        <button onClick={nextMonth} className="text-gray-500 px-2 py-1 text-lg">›</button>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-8">Φόρτωση...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
              <p className="text-2xl font-bold text-green-600">{formatMoney(earned)}</p>
              <p className="text-xs text-gray-400 mt-1">Έσοδα μήνα</p>
            </div>
            {lost > 0 ? (
              <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                <p className="text-2xl font-bold text-red-500">{formatMoney(lost)}</p>
                <p className="text-xs text-red-400 mt-1">Χαμένα (ακυρώσεις)</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
                <p className="text-2xl font-bold text-gray-300">—</p>
                <p className="text-xs text-gray-400 mt-1">Χαμένα</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
              <p className="text-2xl font-bold text-indigo-600">{totalSessions}</p>
              <p className="text-xs text-gray-400 mt-1">Μαθήματα</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
              <p className={`text-2xl font-bold ${cancelled > 0 ? 'text-red-400' : 'text-gray-300'}`}>{cancelled}</p>
              <p className="text-xs text-gray-400 mt-1">Ακυρώσεις</p>
            </div>
          </div>

          {/* Per student */}
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Ανά μαθητή</h2>
          <div className="space-y-2">
            {perStudent.map(({ studentId, sessions, cancelled: stCancelled, income, lost: stLost }) => {
              const student = studentMap[studentId]
              return (
                <div key={studentId} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{student?.name ?? 'Άγνωστος'}</p>
                      <p className="text-xs text-gray-400">
                        {sessions} μαθ.
                        {stCancelled > 0 && (
                          <span className="text-red-400"> · {stCancelled} ακυρ. (−{formatMoney(stLost)})</span>
                        )}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-600">{formatMoney(income)}</p>
                  </div>
                </div>
              )
            })}
            {perStudent.length === 0 && (
              <p className="text-center text-gray-300 py-6">Δεν υπάρχουν δεδομένα για αυτόν τον μήνα</p>
            )}
          </div>

          {/* Legend */}
          <p className="text-xs text-gray-300 text-center mt-4">
            Τα μαθήματα χωρίς καταχώρηση μετρούν αυτόματα ως έσοδο.
          </p>
        </>
      )}
    </div>
  )
}
