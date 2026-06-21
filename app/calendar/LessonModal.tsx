'use client'

import { useState, useMemo } from 'react'
import type { Lesson, Student, LessonStatus, RecurringSlot } from '@/lib/types'
import { formatMoney, lessonEndTime, addDays, DAYS_ORDER } from '@/lib/utils'
import TimePicker from '@/components/TimePicker'

interface Suggestion { date: string; startTime: string; durationMins: number }

function isFullyUnavailable(student: Student, day: typeof DAYS_ORDER[number]): boolean {
  return student.unavailable.some(u => {
    if (u.day !== day) return false
    return u.from <= '08:00' && u.to >= '22:00'
  })
}

function computeReplacements(
  student: Student,
  cancelledDate: string,
  weekStart: string,
  allSlots: RecurringSlot[],
  weekLessons: Lesson[],
): Suggestion[] {
  const suggestions: Suggestion[] = []
  for (const preferredOnly of [true, false]) {
    if (suggestions.length >= 3) break
    for (let weekOffset = 0; weekOffset <= 1 && suggestions.length < 3; weekOffset++) {
      for (let i = 0; i < 7 && suggestions.length < 3; i++) {
        const date = addDays(weekStart, weekOffset * 7 + i)
        if (date === cancelledDate) continue
        const day = DAYS_ORDER[i]
        if (isFullyUnavailable(student, day)) continue
        const pref = student.preferred.find(p => p.day === day)
        if (preferredOnly && !pref) continue
        const hasSlot = allSlots.some(s =>
          s.studentId === student.id && s.active && s.day === day &&
          date >= s.validFrom && (!s.validUntil || date <= s.validUntil)
        )
        if (hasSlot) continue
        const hasLesson = weekLessons.some(l =>
          l.studentId === student.id && l.date === date &&
          l.status !== 'cancelled_student' && l.status !== 'cancelled_didi'
        )
        if (hasLesson) continue
        if (suggestions.some(s => s.date === date)) continue
        suggestions.push({ date, startTime: pref ? pref.from : '15:00', durationMins: student.sessionDurationMins })
      }
    }
  }
  return suggestions
}

interface Props {
  lesson: Lesson
  student: Student | undefined
  onClose: () => void
  onUpdate: (updated: Lesson) => void
  onCreated?: (lesson: Lesson) => void
  weekStart: string
  allSlots: RecurringSlot[]
  weekLessons: Lesson[]
  students: Student[]
}

export default function LessonModal({ lesson, student, onClose, onUpdate, onCreated, weekStart, allSlots, weekLessons }: Props) {
  const [phase, setPhase] = useState<'main' | 'cancelled'>('main')
  const [pendingLesson, setPendingLesson] = useState<Lesson | null>(null)
  const [saving, setSaving] = useState(false)
  const [bookingRep, setBookingRep] = useState(false)
  const [replacementBooked, setReplacementBooked] = useState<string | null>(null)
  const [manualRepDate, setManualRepDate] = useState('')
  const [manualRepTime, setManualRepTime] = useState('15:00')
  const [amount, setAmount] = useState(lesson.amountCharged)
  const [notes, setNotes] = useState(lesson.notes ?? '')

  const endTime = lessonEndTime(lesson.startTime, lesson.durationMins)
  const dateLabel = new Date(lesson.date + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })
  const repAmount = student ? Math.round(student.ratePerHour * lesson.durationMins / 60 * 100) / 100 : 0

  function handleClose() {
    if (pendingLesson) onUpdate(pendingLesson)
    else onClose()
  }

  async function patch(updates: object) {
    setSaving(true)
    const res = await fetch(`/api/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...updates, date: lesson.date }),
    })
    setSaving(false)
    return res
  }

  async function markDone() {
    const res = await patch({ status: 'done' as LessonStatus, amountCharged: amount, notes })
    if (res.ok) onUpdate({ ...lesson, status: 'done' as LessonStatus, amountCharged: amount, notes })
  }

  async function doCancel(status: LessonStatus) {
    const res = await patch({ status, amountCharged: 0, notes })
    if (res.ok) {
      const updated = { ...lesson, status, amountCharged: 0, notes }
      setPendingLesson(updated)
      setPhase('cancelled')
    }
  }

  async function bookReplacement(date: string, startTime: string) {
    setBookingRep(true)
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        studentId: lesson.studentId,
        date, startTime,
        durationMins: lesson.durationMins,
        status: 'scheduled',
        amountCharged: repAmount,
        notes: 'Αναπλήρωση',
      }),
    })
    setBookingRep(false)
    if (res.ok) {
      const created = await res.json()
      onCreated?.(created)
      setReplacementBooked(date)
    }
  }

  const suggestions = useMemo(() => {
    if (phase !== 'cancelled' || !student) return []
    return computeReplacements(student, lesson.date, weekStart, allSlots, weekLessons)
  }, [phase, student, lesson.date, weekStart, allSlots, weekLessons])

  // ── Replacement booked confirmation ──────────────────────────
  if (replacementBooked) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-5 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-bold text-gray-800">Αναπλήρωση καταχωρήθηκε!</p>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(replacementBooked + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{lesson.startTime}–{endTime}
          </p>
          <button onClick={handleClose} className="mt-4 w-full py-2.5 btn-primary text-sm">Κλείσιμο</button>
        </div>
      </div>
    )
  }

  // ── Phase: cancelled → replacement options ────────────────────
  if (phase === 'cancelled') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800">{student?.name}</h2>
              <p className="text-xs text-gray-500">{dateLabel} · {lesson.startTime}–{endTime}</p>
              <p className="text-xs text-red-500 font-semibold mt-0.5">Ακύρωση — {formatMoney(repAmount)} χάθηκαν</p>
            </div>
            <button onClick={handleClose} className="text-gray-400 text-xl leading-none">×</button>
          </div>

          <p className="text-sm font-semibold text-gray-700 mb-2">Θέλεις να κλείσεις αναπλήρωση;</p>

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((sug, i) => {
                const sugLabel = new Date(sug.date + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })
                const sugEnd = lessonEndTime(sug.startTime, sug.durationMins)
                const dow = new Date(sug.date + 'T00:00:00').getDay()
                const dayIdx = dow === 0 ? 6 : dow - 1
                const isPref = student?.preferred.some(p => p.day === DAYS_ORDER[dayIdx])
                return (
                  <button key={i} disabled={bookingRep} onClick={() => bookReplacement(sug.date, sug.startTime)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition disabled:opacity-50">
                    <p className="text-sm font-medium text-orange-800">
                      {sugLabel}
                      {!isPref && <span className="ml-1 text-xs text-gray-400">(εκτός προτίμησης)</span>}
                    </p>
                    <p className="text-xs text-orange-600">{sug.startTime}–{sugEnd} · {formatMoney(repAmount)}</p>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-1">Δεν βρέθηκαν ελεύθερες μέρες αυτή ή την επόμενη εβδομάδα.</p>
          )}

          <div className="pt-2 border-t border-gray-100 mt-2">
            <p className="text-xs text-gray-400 mb-1.5">Ή επίλεξε εσύ:</p>
            <div className="flex gap-2 items-center">
              <input type="date" value={manualRepDate} onChange={e => setManualRepDate(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" />
              <TimePicker value={manualRepTime} onChange={setManualRepTime} />
            </div>
            {manualRepDate && (
              <button disabled={bookingRep} onClick={() => bookReplacement(manualRepDate, manualRepTime)}
                className="mt-2 w-full py-2 btn-primary text-xs disabled:opacity-50">
                {bookingRep ? 'Καταχώρηση...' : 'Καταχώρηση αναπλήρωσης'}
              </button>
            )}
          </div>

          <button onClick={handleClose} className="mt-3 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">
            Όχι, χωρίς αναπλήρωση
          </button>
        </div>
      </div>
    )
  }

  // ── Phase: main ───────────────────────────────────────────────

  // Already done — show with edit
  if (lesson.status === 'done') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{student?.name ?? '—'}</h2>
              <p className="text-sm text-gray-500">{dateLabel}</p>
              <p className="text-sm text-gray-500">{lesson.startTime}–{endTime}</p>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full mt-1 inline-block">✅ Έγινε</span>
            </div>
            <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ποσό (€)</label>
              <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="input" min={0} step={0.5} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Σημειώσεις</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input resize-none" rows={2} />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">Κλείσιμο</button>
            <button onClick={() => patch({ status: 'done' as LessonStatus, amountCharged: amount, notes }).then(r => { if (r.ok) onUpdate({ ...lesson, status: 'done' as LessonStatus, amountCharged: amount, notes }) })} disabled={saving} className="flex-1 py-2.5 btn-primary text-sm disabled:opacity-50">
              {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Already cancelled — show info only
  if (lesson.status === 'cancelled_student' || lesson.status === 'cancelled_didi') {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-800">{student?.name ?? '—'}</h2>
              <p className="text-sm text-gray-500">{dateLabel} · {lesson.startTime}–{endTime}</p>
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full mt-1 inline-block">
                {lesson.status === 'cancelled_student' ? '❌ Ακύρωση μαθητή' : '❌ Ακύρωση Didi'}
              </span>
            </div>
            <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
          </div>
          <button onClick={onClose} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500">Κλείσιμο</button>
        </div>
      </div>
    )
  }

  // Scheduled — action buttons
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{student?.name ?? '—'}</h2>
            <p className="text-sm text-gray-500">{dateLabel}</p>
            <p className="text-sm text-gray-500">{lesson.startTime}–{endTime} · {formatMoney(repAmount)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>

        <p className="text-xs text-gray-400 mb-3">Τι έγινε με αυτό το μάθημα;</p>

        <div className="space-y-2">
          <button disabled={saving} onClick={markDone}
            className="w-full py-3 bg-green-50 border border-green-200 rounded-xl text-sm font-semibold text-green-800 hover:bg-green-100 transition disabled:opacity-50">
            ✅ Έγινε κανονικά
          </button>
          <div className="flex gap-2">
            <button disabled={saving} onClick={() => doCancel('cancelled_student')}
              className="flex-1 py-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50">
              ❌ Ακύρωσε ο μαθητής
            </button>
            <button disabled={saving} onClick={() => doCancel('cancelled_didi')}
              className="flex-1 py-3 bg-orange-50 border border-orange-200 rounded-xl text-xs font-semibold text-orange-700 hover:bg-orange-100 transition disabled:opacity-50">
              ❌ Ακύρωσα εγώ
            </button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          <div className="flex gap-2 items-center">
            <label className="text-xs text-gray-400 shrink-0">Ποσό €</label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm" min={0} step={0.5} />
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Σημειώσεις..."
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs resize-none" rows={2} />
        </div>

        <button onClick={onClose} className="mt-3 w-full py-2 text-xs text-gray-400">
          Κλείσιμο (μετράει ως έσοδο αυτόματα)
        </button>
      </div>
    </div>
  )
}
