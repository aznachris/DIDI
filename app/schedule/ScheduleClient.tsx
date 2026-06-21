'use client'

import { useState } from 'react'
import type { Student, RecurringSlot, DayOfWeek } from '@/lib/types'
import { DAY_LABELS, DAYS_ORDER } from '@/lib/utils'

const DURATIONS = [30, 45, 60, 90, 120]

interface Props { students: Student[]; initialSlots: RecurringSlot[] }

export default function ScheduleClient({ students, initialSlots }: Props) {
  const [slots, setSlots] = useState(initialSlots)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    studentId: students[0]?.id ?? '',
    day: 'MON' as DayOfWeek,
    startTime: '16:00',
    durationMins: 60,
    validFrom: new Date().toISOString().slice(0, 10),
  })
  const [saving, setSaving] = useState(false)

  const studentMap = Object.fromEntries(students.map(s => [s.id, s]))

  // Group slots by day
  const byDay: Record<DayOfWeek, RecurringSlot[]> = Object.fromEntries(
    DAYS_ORDER.map(d => [d, slots.filter(s => s.day === d && s.active).sort((a, b) => a.startTime.localeCompare(b.startTime))])
  ) as Record<DayOfWeek, RecurringSlot[]>

  async function handleAdd() {
    setSaving(true)
    const res = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const slot = await res.json()
    setSlots(prev => [...prev, slot])
    setSaving(false)
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή slot;')) return
    await fetch(`/api/slots/${id}`, { method: 'DELETE' })
    setSlots(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Εβδομαδιαίο Πρόγραμμα</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
          + Slot
        </button>
      </div>

      <div className="space-y-4">
        {DAYS_ORDER.map(day => (
          <div key={day}>
            <h2 className="text-sm font-semibold text-gray-500 mb-2">{DAY_LABELS[day]}</h2>
            {byDay[day].length === 0 ? (
              <p className="text-xs text-gray-300 pl-2">—</p>
            ) : (
              <div className="space-y-2">
                {byDay[day].map(slot => {
                  const student = studentMap[slot.studentId]
                  const endMins = slot.durationMins
                  const [h, m] = slot.startTime.split(':').map(Number)
                  const totalMins = h * 60 + m + endMins
                  const endTime = `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`
                  return (
                    <div key={slot.id} className="bg-white rounded-xl border border-gray-100 px-4 py-2 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-800">{student?.name ?? '—'}</span>
                        <span className="text-sm text-gray-400 ml-2">{slot.startTime}–{endTime}</span>
                        <span className="text-xs text-gray-400 ml-2">({slot.durationMins} λεπτά)</span>
                      </div>
                      <button onClick={() => handleDelete(slot.id)} className="text-red-400 text-sm hover:underline">
                        Διαγρ.
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h2 className="text-lg font-bold mb-4">Νέο Slot</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Μαθητής</label>
                <select
                  value={form.studentId}
                  onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}
                  className="input"
                >
                  {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Μέρα</label>
                  <select
                    value={form.day}
                    onChange={e => setForm(p => ({ ...p, day: e.target.value as DayOfWeek }))}
                    className="input"
                  >
                    {DAYS_ORDER.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Ώρα</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Διάρκεια</label>
                <select
                  value={form.durationMins}
                  onChange={e => setForm(p => ({ ...p, durationMins: Number(e.target.value) }))}
                  className="input"
                >
                  {DURATIONS.map(d => <option key={d} value={d}>{d} λεπτά</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ισχύει από</label>
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={e => setForm(p => ({ ...p, validFrom: e.target.value }))}
                  className="input"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">
                Ακύρωση
              </button>
              <button
                onClick={handleAdd}
                disabled={saving || !form.studentId}
                className="flex-1 py-2.5 btn-primary text-sm disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση...' : 'Προσθήκη'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
