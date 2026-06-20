'use client'

import { useState } from 'react'
import type { Student, Level, AgeGroup, TimeWindow, DayOfWeek } from '@/lib/types'
import { LEVEL_COLORS, DAY_LABELS, DAYS_ORDER, formatMoney } from '@/lib/utils'

const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const AGE_GROUPS: { value: AgeGroup; label: string }[] = [
  { value: 'kid', label: 'Παιδί' },
  { value: 'teen', label: 'Έφηβος' },
  { value: 'adult', label: 'Ενήλικας' },
]
const DURATIONS = [30, 45, 60, 90, 120]

const emptyForm = {
  name: '',
  address: '',
  ratePerHour: 25,
  level: 'A1' as Level,
  ageGroup: 'kid' as AgeGroup,
  notes: '',
  sessionsPerWeek: 2,
  sessionDurationMins: 60,
  preferred: [] as TimeWindow[],
  unavailable: [] as TimeWindow[],
}

type FormState = typeof emptyForm

interface Props { initialStudents: Student[] }

export default function StudentsClient({ initialStudents }: Props) {
  const [students, setStudents] = useState(initialStudents)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Student | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'preferred' | 'unavailable'>('preferred')
  const [geocoding, setGeocoding] = useState(false)

  const missingGeo = students.filter(s => !s.lat || !s.lng).length

  async function handleGeocodeAll() {
    setGeocoding(true)
    await fetch('/api/students/geocode-all', { method: 'POST' })
    // Reload students
    const res = await fetch('/api/students')
    setStudents(await res.json())
    setGeocoding(false)
  }

  function openNew() {
    setEditing(null)
    setForm(emptyForm)
    setShowForm(true)
    setActiveTab('preferred')
  }

  function openEdit(s: Student) {
    setEditing(s)
    setForm({
      name: s.name,
      address: s.address,
      ratePerHour: s.ratePerHour,
      level: s.level,
      ageGroup: s.ageGroup,
      notes: s.notes ?? '',
      sessionsPerWeek: s.sessionsPerWeek ?? 2,
      sessionDurationMins: s.sessionDurationMins ?? 60,
      preferred: s.preferred ?? [],
      unavailable: s.unavailable ?? [],
    })
    setShowForm(true)
    setActiveTab('preferred')
  }

  async function handleSave() {
    setSaving(true)
    if (editing) {
      const res = await fetch(`/api/students/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const updated = await res.json()
      setStudents(prev => prev.map(s => s.id === editing.id ? updated : s))
    } else {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const created = await res.json()
      setStudents(prev => [...prev, created])
    }
    setSaving(false)
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Διαγραφή μαθητή;')) return
    await fetch(`/api/students/${id}`, { method: 'DELETE' })
    setStudents(prev => prev.filter(s => s.id !== id))
  }

  function toggleWindow(type: 'preferred' | 'unavailable', day: DayOfWeek) {
    setForm(prev => {
      const list = prev[type]
      const exists = list.find(a => a.day === day)
      if (exists) return { ...prev, [type]: list.filter(a => a.day !== day) }
      return { ...prev, [type]: [...list, { day, from: '16:00', to: '20:00' }] }
    })
  }

  function updateWindow(type: 'preferred' | 'unavailable', day: DayOfWeek, field: 'from' | 'to', val: string) {
    setForm(prev => ({
      ...prev,
      [type]: prev[type].map(a => a.day === day ? { ...a, [field]: val } : a),
    }))
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.address.toLowerCase().includes(search.toLowerCase())
  )

  const totalHoursPerWeek = (s: Student) =>
    ((s.sessionsPerWeek ?? 1) * (s.sessionDurationMins ?? 60) / 60).toFixed(1)

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-800">Μαθητές</h1>
        <button onClick={openNew} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
          + Νέος
        </button>
      </div>

      {missingGeo > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
          <p className="text-sm text-amber-700">
            📍 {missingGeo} μαθητές χωρίς συντεταγμένες
          </p>
          <button
            onClick={handleGeocodeAll}
            disabled={geocoding}
            className="text-sm font-semibold text-amber-800 underline disabled:opacity-50"
          >
            {geocoding ? 'Geocoding...' : 'Geocode όλους'}
          </button>
        </div>
      )}

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Αναζήτηση..."
        className="w-full border border-gray-200 rounded-xl px-4 py-2 mb-4 text-sm"
      />

      <div className="space-y-3">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-800">{s.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEVEL_COLORS[s.level]}`}>
                    {s.level}
                  </span>
                  <span className="text-xs text-gray-400">
                    {AGE_GROUPS.find(a => a.value === s.ageGroup)?.label}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5 truncate">
                  <span title={s.lat ? `${s.lat.toFixed(4)}, ${s.lng?.toFixed(4)}` : 'Χωρίς συντεταγμένες'}>
                    {s.lat ? '📍' : '⚠️'}
                  </span>{' '}
                  {s.address}
                </p>
                <div className="flex gap-3 mt-1">
                  <p className="text-sm font-medium text-green-700">{formatMoney(s.ratePerHour)}/ώρα</p>
                  <p className="text-sm text-indigo-600">
                    {s.sessionsPerWeek ?? 1}× {s.sessionDurationMins ?? 60}λ/εβδ
                    <span className="text-gray-400 ml-1">({totalHoursPerWeek(s)}h)</span>
                  </p>
                </div>
                {s.notes && <p className="text-xs text-gray-400 mt-1">{s.notes}</p>}
              </div>
              <div className="flex gap-2 ml-2 shrink-0">
                <button onClick={() => openEdit(s)} className="text-indigo-600 text-sm hover:underline">Επεξ.</button>
                <button onClick={() => handleDelete(s.id)} className="text-red-500 text-sm hover:underline">Διαγρ.</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">Δεν βρέθηκαν μαθητές</p>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] overflow-y-auto p-5">
            <h2 className="text-lg font-bold mb-4">{editing ? 'Επεξεργασία' : 'Νέος Μαθητής'}</h2>

            <div className="space-y-3">
              {/* Basic info */}
              <input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Όνομα"
                className="input"
              />
              <input
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Διεύθυνση (π.χ. Κεφαληνίας 15, Αθήνα)"
                className="input"
              />

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">€/ώρα</label>
                  <input type="number" value={form.ratePerHour}
                    onChange={e => setForm(p => ({ ...p, ratePerHour: Number(e.target.value) }))}
                    className="input" min={0} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Επίπεδο</label>
                  <select value={form.level}
                    onChange={e => setForm(p => ({ ...p, level: e.target.value as Level }))}
                    className="input">
                    {LEVELS.map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Ηλικία</label>
                  <select value={form.ageGroup}
                    onChange={e => setForm(p => ({ ...p, ageGroup: e.target.value as AgeGroup }))}
                    className="input">
                    {AGE_GROUPS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Sessions config */}
              <div className="bg-indigo-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-indigo-700 mb-2">Εβδομαδιαίο Πρόγραμμα</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Sessions/εβδ.</label>
                    <input type="number" value={form.sessionsPerWeek}
                      onChange={e => setForm(p => ({ ...p, sessionsPerWeek: Number(e.target.value) }))}
                      className="input" min={1} max={7} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Διάρκεια</label>
                    <select value={form.sessionDurationMins}
                      onChange={e => setForm(p => ({ ...p, sessionDurationMins: Number(e.target.value) }))}
                      className="input">
                      {DURATIONS.map(d => <option key={d} value={d}>{d} λεπτά</option>)}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-indigo-500 mt-2">
                  Σύνολο: {((form.sessionsPerWeek * form.sessionDurationMins) / 60).toFixed(1)}h/εβδ ·{' '}
                  {formatMoney(form.sessionsPerWeek * form.sessionDurationMins / 60 * form.ratePerHour * 4.33)}/μήνα
                </p>
              </div>

              {/* Availability tabs */}
              <div>
                <div className="flex border-b border-gray-200 mb-3">
                  <button
                    onClick={() => setActiveTab('preferred')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'preferred' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-400'}`}
                  >
                    Προτιμώμενες ώρες
                  </button>
                  <button
                    onClick={() => setActiveTab('unavailable')}
                    className={`px-4 py-2 text-sm font-medium ${activeTab === 'unavailable' ? 'border-b-2 border-red-500 text-red-500' : 'text-gray-400'}`}
                  >
                    Μη διαθέσιμος
                  </button>
                </div>

                <div className="space-y-2">
                  {DAYS_ORDER.map(day => {
                    const window = form[activeTab].find(a => a.day === day)
                    const color = activeTab === 'preferred'
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                      : 'bg-red-50 border-red-300 text-red-700'
                    return (
                      <div key={day} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleWindow(activeTab, day)}
                          className={`w-24 text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
                            window ? color : 'bg-gray-50 border-gray-200 text-gray-400'
                          }`}
                        >
                          {DAY_LABELS[day]}
                        </button>
                        {window && (
                          <>
                            <input type="time" value={window.from}
                              onChange={e => updateWindow(activeTab, day, 'from', e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-24" />
                            <span className="text-xs text-gray-400">–</span>
                            <input type="time" value={window.to}
                              onChange={e => updateWindow(activeTab, day, 'to', e.target.value)}
                              className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-24" />
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Σημειώσεις (προαιρετικό)"
                className="input resize-none"
                rows={2}
              />
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm">
                Ακύρωση
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.address}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {saving ? 'Αποθήκευση...' : 'Αποθήκευση'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
