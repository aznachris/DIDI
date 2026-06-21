'use client'

import { useState } from 'react'
import type { RecurringSlot, Student, Lesson, LessonStatus } from '@/lib/types'
import { formatMoney, lessonEndTime, addDays, DAYS_ORDER } from '@/lib/utils'
import TimePicker from '@/components/TimePicker'

interface Suggestion { date: string; startTime: string; durationMins: number }

function isFullyUnavailable(student: Student, day: typeof DAYS_ORDER[number]): boolean {
  return student.unavailable.some(u => {
    if (u.day !== day) return false
    const from = u.from <= '08:00'
    const to = u.to >= '22:00'
    return from && to
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

  // Two passes: preferred days first, then any free day
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

        // Already added this date from the preferred pass?
        if (suggestions.some(s => s.date === date)) continue

        suggestions.push({
          date,
          startTime: pref ? pref.from : '15:00',
          durationMins: student.sessionDurationMins,
        })
      }
    }
  }

  return suggestions
}

interface Props {
  slot: RecurringSlot
  date: string
  student: Student | undefined
  weekStart: string
  allSlots: RecurringSlot[]
  weekLessons: Lesson[]
  onClose: () => void
  onCreated: (lesson: Lesson) => void
}

export default function SlotModal({ slot, date, student, weekStart, allSlots, weekLessons, onClose, onCreated }: Props) {
  const [phase, setPhase] = useState<'choose' | 'cancelled' | 'done'>('choose')
  const [saving, setSaving] = useState(false)
  const [replacementBooked, setReplacementBooked] = useState<string | null>(null)
  const [manualRepDate, setManualRepDate] = useState('')
  const [manualRepTime, setManualRepTime] = useState('15:00')

  const endTime = lessonEndTime(slot.startTime, slot.durationMins)
  const amount = student ? Math.round(student.ratePerHour * slot.durationMins / 60 * 100) / 100 : 0
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })

  async function postLesson(body: object): Promise<Lesson | null> {
    setSaving(true)
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) return null
    return res.json()
  }

  async function markDone() {
    const lesson = await postLesson({
      studentId: slot.studentId,
      recurringSlotId: slot.id,
      date, startTime: slot.startTime, durationMins: slot.durationMins,
      status: 'done', amountCharged: amount,
    })
    if (lesson) { onCreated(lesson); onClose() }
  }

  async function confirmCancel(status: LessonStatus) {
    const lesson = await postLesson({
      studentId: slot.studentId,
      recurringSlotId: slot.id,
      date, startTime: slot.startTime, durationMins: slot.durationMins,
      status, amountCharged: 0,
    })
    if (lesson) { onCreated(lesson); setPhase('cancelled') }
  }

  async function bookReplacement(sug: Suggestion) {
    const lesson = await postLesson({
      studentId: slot.studentId,
      date: sug.date, startTime: sug.startTime, durationMins: sug.durationMins,
      status: 'scheduled', amountCharged: amount,
      notes: 'Αναπλήρωση',
    })
    if (lesson) { onCreated(lesson); setReplacementBooked(sug.date) }
  }

  async function bookManualReplacement() {
    if (!manualRepDate) return
    await bookReplacement({ date: manualRepDate, startTime: manualRepTime, durationMins: slot.durationMins })
  }

  // After replacement booked
  if (replacementBooked) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-5 text-center">
          <p className="text-3xl mb-2">✅</p>
          <p className="font-bold text-gray-800">Αναπλήρωση καταχωρήθηκε</p>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(replacementBooked + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}{slot.startTime}–{endTime}
          </p>
          <button onClick={onClose} className="mt-4 w-full py-2.5 btn-primary text-sm">Κλείσιμο</button>
        </div>
      </div>
    )
  }

  // After cancellation confirmed — show suggestions
  if (phase === 'cancelled') {
    const suggestions = student
      ? computeReplacements(student, date, weekStart, allSlots, weekLessons)
      : []
    return (
      <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-sm p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-800">{student?.name}</h2>
              <p className="text-xs text-gray-500">{dateLabel} · {slot.startTime}–{endTime}</p>
              <p className="text-xs text-red-500 font-semibold mt-0.5">Ακύρωση — €{amount.toFixed(2)} χάθηκαν</p>
            </div>
            <button onClick={onClose} className="text-gray-400 text-xl">×</button>
          </div>

          <p className="text-sm font-semibold text-gray-700 mb-2">Θέλεις να κλείσεις αναπλήρωση;</p>

          {suggestions.length > 0 ? (
            <div className="space-y-2">
              {suggestions.map((sug, i) => {
                const sugLabel = new Date(sug.date + 'T00:00:00').toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long' })
                const sugEnd = lessonEndTime(sug.startTime, sug.durationMins)
                const isPref = student?.preferred.some(p => p.day === DAYS_ORDER[new Date(sug.date + 'T00:00:00').getDay() === 0 ? 6 : new Date(sug.date + 'T00:00:00').getDay() - 1])
                return (
                  <button key={i} disabled={saving} onClick={() => bookReplacement(sug)}
                    className="w-full text-left px-3 py-2.5 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition disabled:opacity-50">
                    <p className="text-sm font-medium text-orange-800">
                      {sugLabel}
                      {!isPref && <span className="ml-1 text-xs text-gray-400">(εκτός προτίμησης)</span>}
                    </p>
                    <p className="text-xs text-orange-600">{sug.startTime}–{sugEnd} · {formatMoney(amount)}</p>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-1">Δεν βρέθηκαν ελεύθερες μέρες αυτή ή την επόμενη εβδομάδα.</p>
          )}

          <div className="pt-2 border-t border-slate-100 mt-2">
            <p className="text-xs text-slate-500 mb-1.5">Ή επίλεξε εσύ:</p>
            <div className="flex gap-2 items-center">
              <input type="date" value={manualRepDate} onChange={e => setManualRepDate(e.target.value)}
                min={date}
                className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
              <TimePicker value={manualRepTime} onChange={setManualRepTime} />
            </div>
            {manualRepDate && (
              <button disabled={saving} onClick={() => bookManualReplacement()}
                className="mt-2 w-full py-2 btn-primary text-xs disabled:opacity-50">
                {saving ? 'Καταχώρηση...' : 'Καταχώρηση αναπλήρωσης'}
              </button>
            )}
          </div>

          <button onClick={onClose} className="mt-4 w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600">
            Όχι, χωρίς αναπλήρωση
          </button>
        </div>
      </div>
    )
  }

  // Initial: choose what happened
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{student?.name ?? '—'}</h2>
            <p className="text-sm text-gray-500">{dateLabel}</p>
            <p className="text-sm text-gray-500">{slot.startTime}–{endTime} · {formatMoney(amount)}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>

        <p className="text-xs text-gray-500 mb-3">Τι έγινε με αυτό το μάθημα;</p>

        <div className="space-y-2">
          <button disabled={saving} onClick={markDone}
            className="w-full py-3 bg-green-50 border border-green-200 rounded-xl text-sm font-semibold text-green-800 hover:bg-green-100 transition disabled:opacity-50">
            ✅ Έγινε κανονικά
          </button>

          <div className="flex gap-2">
            <button disabled={saving}
              onClick={() => confirmCancel('cancelled_student')}
              className="flex-1 py-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 hover:bg-red-100 transition disabled:opacity-50">
              ❌ Ακύρωσε ο μαθητής
            </button>
            <button disabled={saving}
              onClick={() => confirmCancel('cancelled_didi')}
              className="flex-1 py-3 bg-orange-50 border border-orange-200 rounded-xl text-xs font-semibold text-orange-700 hover:bg-orange-100 transition disabled:opacity-50">
              ❌ Ακύρωσα εγώ
            </button>
          </div>
        </div>

        <button onClick={onClose} className="mt-3 w-full py-2 text-xs text-gray-400">
          Κλείσιμο (θα μετρηθεί ως έσοδο αυτόματα)
        </button>
      </div>
    </div>
  )
}
