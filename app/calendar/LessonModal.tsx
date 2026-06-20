'use client'

import { useState } from 'react'
import type { Lesson, Student, LessonStatus } from '@/lib/types'
import { formatMoney, lessonEndTime, DAY_LABELS, dateToDayOfWeek } from '@/lib/utils'

const STATUS_LABELS: Record<LessonStatus, string> = {
  scheduled: '⏳ Προγραμματισμένο',
  done: '✅ Έγινε',
  cancelled_student: '❌ Ακύρωση (μαθητής)',
  cancelled_didi: '❌ Ακύρωση (Didi)',
}

interface Props {
  lesson: Lesson
  student: Student | undefined
  onClose: () => void
  onUpdate: (updated: Lesson) => void
}

export default function LessonModal({ lesson, student, onClose, onUpdate }: Props) {
  const [status, setStatus] = useState<LessonStatus>(lesson.status)
  const [amount, setAmount] = useState(lesson.amountCharged)
  const [notes, setNotes] = useState(lesson.notes ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const updated: Lesson = { ...lesson, status, amountCharged: amount, notes }
    const res = await fetch(`/api/lessons/${lesson.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, amountCharged: amount, notes, date: lesson.date }),
    })
    if (res.ok) {
      onUpdate(updated)
    }
    setSaving(false)
  }

  const dayLabel = DAY_LABELS[dateToDayOfWeek(lesson.date)]
  const dateDisplay = `${dayLabel} ${new Date(lesson.date + 'T00:00:00').toLocaleDateString('el-GR')}`
  const endTime = lessonEndTime(lesson.startTime, lesson.durationMins)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{student?.name ?? 'Άγνωστος'}</h2>
            <p className="text-sm text-gray-500">{dateDisplay}</p>
            <p className="text-sm text-gray-500">{lesson.startTime} – {endTime}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Κατάσταση</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as LessonStatus)}
              className="input"
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Ποσό (€)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="input"
              min={0}
              step={0.5}
            />
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Σημειώσεις</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">
            Κλείσιμο
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
          </button>
        </div>
      </div>
    </div>
  )
}
