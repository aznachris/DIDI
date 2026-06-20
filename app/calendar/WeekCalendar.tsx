'use client'

import { useState, useMemo } from 'react'
import type { Student, RecurringSlot, Lesson, DayOfWeek } from '@/lib/types'
import {
  DAY_LABELS, DAYS_ORDER, isoDate, addDays, timeToMinutes,
  lessonEndTime, formatMoney, minutesToTime
} from '@/lib/utils'
import LessonModal from './LessonModal'

const HOUR_START = 8
const HOUR_END = 21
const TOTAL_MINS = (HOUR_END - HOUR_START) * 60
const SLOT_HEIGHT = 600 // px for the full grid

const STUDENT_COLORS = [
  'bg-indigo-200 border-indigo-400 text-indigo-900',
  'bg-pink-200 border-pink-400 text-pink-900',
  'bg-amber-200 border-amber-400 text-amber-900',
  'bg-emerald-200 border-emerald-400 text-emerald-900',
  'bg-sky-200 border-sky-400 text-sky-900',
  'bg-violet-200 border-violet-400 text-violet-900',
  'bg-orange-200 border-orange-400 text-orange-900',
  'bg-teal-200 border-teal-400 text-teal-900',
]

interface Props {
  students: Student[]
  slots: RecurringSlot[]
  lessons: Lesson[]
  today: string
  initialWeekStart: string
}

export default function WeekCalendar({ students, slots, lessons, today, initialWeekStart }: Props) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  const [localLessons, setLocalLessons] = useState<Lesson[]>(lessons)

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])
  const colorMap = useMemo(() => {
    const m: Record<string, string> = {}
    students.forEach((s, i) => { m[s.id] = STUDENT_COLORS[i % STUDENT_COLORS.length] })
    return m
  }, [students])

  // Days of current week: Mon–Sun
  const weekDays = useMemo(() =>
    DAYS_ORDER.map((day, i) => ({
      day,
      date: addDays(weekStart, i),
      label: DAY_LABELS[day],
    })),
    [weekStart]
  )

  // All lessons for this week
  const weekLessons = useMemo(() =>
    localLessons.filter(l => {
      const d = new Date(l.date + 'T00:00:00')
      const ws = new Date(weekStart + 'T00:00:00')
      const we = new Date(addDays(weekStart, 6) + 'T00:00:00')
      return d >= ws && d <= we
    }),
    [localLessons, weekStart]
  )

  function prevWeek() { setWeekStart(addDays(weekStart, -7)) }
  function nextWeek() { setWeekStart(addDays(weekStart, 7)) }
  function goToday() {
    const ws = isoDate(new Date())
    // calc monday
    const d = new Date(ws + 'T00:00:00')
    const day = d.getDay()
    const diff = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diff)
    setWeekStart(isoDate(d))
  }

  function positionStyle(startTime: string, durationMins: number) {
    const startMins = timeToMinutes(startTime) - HOUR_START * 60
    const top = (startMins / TOTAL_MINS) * SLOT_HEIGHT
    const height = Math.max((durationMins / TOTAL_MINS) * SLOT_HEIGHT, 20)
    return { top: `${top}px`, height: `${height}px` }
  }

  function handleLessonUpdate(updated: Lesson) {
    setLocalLessons(prev => prev.map(l => l.id === updated.id ? updated : l))
    setSelectedLesson(null)
  }

  const weekLabel = (() => {
    const ws = new Date(weekStart + 'T00:00:00')
    const we = new Date(addDays(weekStart, 6) + 'T00:00:00')
    return `${ws.getDate()}/${ws.getMonth() + 1} – ${we.getDate()}/${we.getMonth() + 1}/${we.getFullYear()}`
  })()

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
        <button onClick={prevWeek} className="text-gray-500 px-2 py-1 text-lg">‹</button>
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-800">{weekLabel}</p>
          <button onClick={goToday} className="text-xs text-indigo-600 underline">Σήμερα</button>
        </div>
        <button onClick={nextWeek} className="text-gray-500 px-2 py-1 text-lg">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-8 bg-white border-b border-gray-200 sticky top-[57px] z-20">
        <div className="col-span-1" /> {/* time gutter */}
        {weekDays.map(({ day, date, label }) => (
          <div
            key={day}
            className={`col-span-1 text-center py-2 ${date === today ? 'bg-indigo-50' : ''}`}
          >
            <p className="text-[10px] text-gray-400 uppercase">{label.slice(0, 3)}</p>
            <p className={`text-sm font-bold ${date === today ? 'text-indigo-600' : 'text-gray-700'}`}>
              {new Date(date + 'T00:00:00').getDate()}
            </p>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-8" style={{ height: `${SLOT_HEIGHT}px`, position: 'relative' }}>
          {/* Hour lines + labels */}
          <div className="col-span-1 relative">
            {Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => {
              const hour = HOUR_START + i
              const top = (i / (HOUR_END - HOUR_START)) * SLOT_HEIGHT
              return (
                <div key={hour} className="absolute right-2 text-[10px] text-gray-300 -translate-y-2" style={{ top }}>
                  {hour}:00
                </div>
              )
            })}
          </div>

          {/* Day columns */}
          {weekDays.map(({ day, date }) => {
            const dayLessons = weekLessons.filter(l => l.date === date && l.status !== 'cancelled_student' && l.status !== 'cancelled_didi')
            return (
              <div
                key={day}
                className={`col-span-1 relative border-l border-gray-100 ${date === today ? 'bg-indigo-50/40' : ''}`}
              >
                {/* Hour lines */}
                {Array.from({ length: HOUR_END - HOUR_START }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-gray-100"
                    style={{ top: `${(i / (HOUR_END - HOUR_START)) * SLOT_HEIGHT}px` }}
                  />
                ))}

                {/* Lessons */}
                {dayLessons.map(lesson => {
                  const student = studentMap[lesson.studentId]
                  const color = colorMap[lesson.studentId]
                  const style = positionStyle(lesson.startTime, lesson.durationMins)
                  const endTime = lessonEndTime(lesson.startTime, lesson.durationMins)
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => setSelectedLesson(lesson)}
                      className={`absolute left-0.5 right-0.5 rounded border text-left px-1 overflow-hidden ${color} ${lesson.status === 'done' ? 'opacity-60' : ''}`}
                      style={style}
                    >
                      <p className="text-[10px] font-bold leading-tight truncate">{student?.name ?? '—'}</p>
                      <p className="text-[9px] opacity-70">{lesson.startTime}–{endTime}</p>
                      <p className="text-[9px] font-medium">{formatMoney(lesson.amountCharged)}</p>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Lesson detail modal */}
      {selectedLesson && (
        <LessonModal
          lesson={selectedLesson}
          student={studentMap[selectedLesson.studentId]}
          onClose={() => setSelectedLesson(null)}
          onUpdate={handleLessonUpdate}
        />
      )}
    </div>
  )
}
