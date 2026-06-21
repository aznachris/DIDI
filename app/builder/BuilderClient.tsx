'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, TouchSensor, useSensor, useSensors, useDroppable, useDraggable
} from '@dnd-kit/core'
import type { Student, RecurringSlot, DidiBlock, ProposedSlot, DayOfWeek } from '@/lib/types'
import { generateSchedule } from '@/lib/scheduler'
import { DAY_LABELS, DAYS_ORDER, timeToMinutes, minutesToTime, formatMoney } from '@/lib/utils'
import { newId } from '@/lib/utils'

const HOUR_START = 8
const HOUR_END = 22
const STEP = 30
const CELL_H = 36 // px per 30min slot
const TOTAL_SLOTS = (HOUR_END - HOUR_START) * 2 // 28 slots

const STUDENT_COLORS = [
  { bg: 'bg-indigo-400', text: 'text-white', light: 'bg-indigo-100', border: 'border-indigo-400' },
  { bg: 'bg-pink-400',   text: 'text-white', light: 'bg-pink-100',   border: 'border-pink-400' },
  { bg: 'bg-amber-400',  text: 'text-white', light: 'bg-amber-100',  border: 'border-amber-400' },
  { bg: 'bg-emerald-500',text: 'text-white', light: 'bg-emerald-100',border: 'border-emerald-400' },
  { bg: 'bg-sky-400',    text: 'text-white', light: 'bg-sky-100',    border: 'border-sky-400' },
  { bg: 'bg-violet-400', text: 'text-white', light: 'bg-violet-100', border: 'border-violet-400' },
  { bg: 'bg-orange-400', text: 'text-white', light: 'bg-orange-100', border: 'border-orange-400' },
  { bg: 'bg-teal-500',   text: 'text-white', light: 'bg-teal-100',   border: 'border-teal-400' },
  { bg: 'bg-rose-400',   text: 'text-white', light: 'bg-rose-100',   border: 'border-rose-400' },
  { bg: 'bg-cyan-500',   text: 'text-white', light: 'bg-cyan-100',   border: 'border-cyan-400' },
]

interface GridSlot {
  id: string
  studentId: string
  day: DayOfWeek
  startMins: number
  durationMins: number
  warnings: string[]
}

interface Props {
  students: Student[]
  existingSlots: RecurringSlot[]
  didiBlocks: DidiBlock[]
}

function slotKey(day: DayOfWeek, startMins: number) {
  return `${day}-${startMins}`
}

// ── Draggable card ────────────────────────────────────────
function DraggableCard({ slot, student, color, height }: {
  slot: GridSlot; student: Student; color: typeof STUDENT_COLORS[0]; height: number
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: slot.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ height }}
      className={`
        absolute inset-x-0.5 rounded-lg px-1.5 py-1 cursor-grab active:cursor-grabbing
        border ${color.border} ${color.light} overflow-hidden select-none
        ${isDragging ? 'opacity-40 z-50 shadow-lg' : 'z-10'}
        ${slot.warnings.length ? 'border-dashed border-2' : 'border'}
      `}
    >
      <p className="text-[10px] font-bold leading-tight truncate text-gray-800">{student.name}</p>
      <p className="text-[9px] text-gray-500">{minutesToTime(slot.startMins)}–{minutesToTime(slot.startMins + slot.durationMins)}</p>
      {slot.warnings.length > 0 && <span className="text-[9px]">⚠️</span>}
    </div>
  )
}

// ── Droppable cell ────────────────────────────────────────
function DroppableCell({ id, isOccupied, isUnavailable }: {
  id: string; isOccupied: boolean; isUnavailable: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ height: CELL_H }}
      className={`
        border-t border-gray-100 relative transition-colors
        ${isOver && !isOccupied ? 'bg-orange-50' : ''}
        ${isUnavailable ? 'bg-red-50/40' : ''}
      `}
    />
  )
}

export default function BuilderClient({ students, existingSlots, didiBlocks }: Props) {
  const [phase, setPhase] = useState<'generate' | 'edit'>('generate')
  const [gridSlots, setGridSlots] = useState<GridSlot[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState('')
  const router = useRouter()

  const activeStudents = useMemo(() => students.filter(s => s.active && s.sessionsPerWeek > 0), [students])

  const colorMap = useMemo(() => {
    const m: Record<string, typeof STUDENT_COLORS[0]> = {}
    activeStudents.forEach((s, i) => { m[s.id] = STUDENT_COLORS[i % STUDENT_COLORS.length] })
    return m
  }, [activeStudents])

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])

  // Time slots: every 30 min from 8:00 to 22:00
  const timeSlots = useMemo(() =>
    Array.from({ length: TOTAL_SLOTS }, (_, i) => HOUR_START * 60 + i * STEP),
    []
  )

  // Build occupied map for quick lookup
  const occupiedMap = useMemo(() => {
    const m = new Set<string>()
    gridSlots.forEach(gs => {
      const numSlots = gs.durationMins / STEP
      for (let i = 0; i < numSlots; i++) {
        m.add(slotKey(gs.day, gs.startMins + i * STEP))
      }
    })
    return m
  }, [gridSlots])

  // Didi's unavailable cells
  const didiUnavailMap = useMemo(() => {
    const m = new Set<string>()
    didiBlocks.forEach(b => {
      const from = timeToMinutes(b.from)
      const to = timeToMinutes(b.to)
      for (let t = from; t < to; t += STEP) {
        m.add(slotKey(b.day, t))
      }
    })
    return m
  }, [didiBlocks])

  function handleGenerate() {
    setGenerating(true)
    // Small delay so UI shows loading state
    setTimeout(() => {
      const proposed: ProposedSlot[] = generateSchedule(activeStudents, didiBlocks)
      const slots: GridSlot[] = proposed.map(p => ({
        id: newId(),
        studentId: p.studentId,
        day: p.day,
        startMins: timeToMinutes(p.startTime),
        durationMins: p.durationMins,
        warnings: p.warnings,
      }))
      setGridSlots(slots)
      setGenerating(false)
      setPhase('edit')
    }, 100)
  }

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const slots: Omit<RecurringSlot, 'id'>[] = gridSlots.map(gs => ({
        studentId: gs.studentId,
        day: gs.day,
        startTime: minutesToTime(gs.startMins),
        durationMins: gs.durationMins,
        validFrom: today,
        active: true,
      }))
      const res = await fetch('/api/slots/replace', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slots),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setSaveError(`Σφάλμα: ${err.error ?? res.status}`)
      } else {
        setSaveSuccess(true)
        router.refresh()
        setTimeout(() => setSaveSuccess(false), 3000)
      }
    } catch (e) {
      setSaveError('Αποτυχία σύνδεσης')
    } finally {
      setSaving(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  )

  function handleDragStart(e: DragStartEvent) {
    setActiveId(e.active.id as string)
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const slotId = active.id as string
    const [targetDay, targetMinsStr] = (over.id as string).split('-')
    const targetMins = parseInt(targetMinsStr)

    setGridSlots(prev => {
      const slot = prev.find(s => s.id === slotId)
      if (!slot) return prev

      // Check target is free (excluding dragged slot)
      const others = prev.filter(s => s.id !== slotId)
      const numCells = slot.durationMins / STEP
      for (let i = 0; i < numCells; i++) {
        const key = slotKey(targetDay as DayOfWeek, targetMins + i * STEP)
        const isOccupied = others.some(o => {
          const oCells = o.durationMins / STEP
          for (let j = 0; j < oCells; j++) {
            if (slotKey(o.day, o.startMins + j * STEP) === key) return true
          }
          return false
        })
        if (isOccupied) return prev
        if (didiUnavailMap.has(key)) return prev
      }

      // Check student hard unavailability
      const student = studentMap[slot.studentId]
      if (student) {
        const endMins = targetMins + slot.durationMins
        const isUnavail = student.unavailable.some(w =>
          w.day === targetDay &&
          timeToMinutes(w.from) < endMins &&
          timeToMinutes(w.to) > targetMins
        )
        if (isUnavail) return prev
      }

      // Recompute warnings
      const isPreferred = student?.preferred.some(w =>
        w.day === targetDay &&
        timeToMinutes(w.from) <= targetMins &&
        timeToMinutes(w.to) >= targetMins + slot.durationMins
      ) ?? false

      const newWarnings: string[] = []
      if (!isPreferred && (student?.preferred.length ?? 0) > 0) {
        newWarnings.push('Εκτός προτιμώμενων ωρών')
      }

      return prev.map(s => s.id === slotId
        ? { ...s, day: targetDay as DayOfWeek, startMins: targetMins, warnings: newWarnings }
        : s
      )
    })
  }

  function removeSlot(id: string) {
    setGridSlots(prev => prev.filter(s => s.id !== id))
  }

  // Summary stats
  const summary = useMemo(() => {
    const byStudent: Record<string, number> = {}
    gridSlots.forEach(gs => {
      byStudent[gs.studentId] = (byStudent[gs.studentId] ?? 0) + 1
    })
    const totalWeeklyIncome = gridSlots.reduce((sum, gs) => {
      const s = studentMap[gs.studentId]
      return sum + (s ? s.ratePerHour * gs.durationMins / 60 : 0)
    }, 0)
    const warnings = gridSlots.filter(s => s.warnings.length > 0).length
    return { byStudent, totalWeeklyIncome, warnings }
  }, [gridSlots, studentMap])

  const activeSlot = gridSlots.find(s => s.id === activeId)
  const activeStudent = activeSlot ? studentMap[activeSlot.studentId] : null

  // ── Generate phase ────────────────────────────────────────
  if (phase === 'generate') {
    return (
      <div className="p-4 pb-24 max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Δημιουργία Προγράμματος</h1>
        <p className="text-sm text-gray-500 mb-6">
          Ο αλγόριθμος θα δημιουργήσει το βέλτιστο εβδομαδιαίο πρόγραμμα βάσει constraints και γεωγραφικής εγγύτητας.
        </p>

        {/* Student list preview */}
        <div className="space-y-2 mb-6">
          {activeStudents.map((s, i) => {
            const color = STUDENT_COLORS[i % STUDENT_COLORS.length]
            return (
              <div key={s.id} className={`${color.light} border ${color.border} rounded-xl px-4 py-3 flex items-center justify-between`}>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{s.name}</p>
                  <p className="text-xs text-gray-500">
                    {s.sessionsPerWeek}× {s.sessionDurationMins}λ · {s.preferred.length > 0 ? `${s.preferred.length} προτ. μέρες` : 'χωρίς προτίμηση'}
                    {s.unavailable.length > 0 ? ` · ${s.unavailable.length} μη διαθ.` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-600">{formatMoney(s.ratePerHour * s.sessionsPerWeek * s.sessionDurationMins / 60 * 4.33)}/μήνα</p>
                </div>
              </div>
            )
          })}
          {activeStudents.length === 0 && (
            <p className="text-center text-gray-400 py-8">Δεν υπάρχουν μαθητές. Πρόσθεσε μαθητές πρώτα.</p>
          )}
        </div>

        {activeStudents.length > 0 && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full py-4 btn-primary text-base disabled:opacity-50"
          >
            {generating ? '⚙️ Υπολογισμός...' : '✨ Δημιούργησε Πρόγραμμα'}
          </button>
        )}
      </div>
    )
  }

  // ── Edit phase ────────────────────────────────────────────
  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-screen max-h-screen overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0 gap-2">
          <button onClick={() => setPhase('generate')} className="text-sm text-gray-500 hover:text-gray-700">
            ← Επαναδημιούργηση
          </button>
          <div className="flex items-center gap-2">
            {saveError && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">{saveError}</span>
            )}
            {summary.warnings > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
                ⚠️ {summary.warnings} προειδοπ.
              </span>
            )}
            <span className="text-xs text-gray-500">
              {formatMoney(summary.totalWeeklyIncome)}/εβδ
            </span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm px-4 py-1.5 disabled:opacity-50"
            >
              {saving ? 'Αποθήκευση...' : saveSuccess ? '✓ Αποθηκεύτηκε!' : 'Αποθήκευση'}
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-2 px-3 py-1.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
          {activeStudents.map((s, i) => {
            const color = STUDENT_COLORS[i % STUDENT_COLORS.length]
            const count = gridSlots.filter(gs => gs.studentId === s.id).length
            return (
              <div key={s.id} className={`flex items-center gap-1 ${color.light} ${color.border} border rounded-full px-2 py-0.5 shrink-0`}>
                <span className="text-[10px] font-semibold text-gray-700">{s.name}</span>
                <span className="text-[10px] text-gray-400">{count}/{s.sessionsPerWeek}</span>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-auto">
          <div className="flex" style={{ minWidth: 520 }}>

            {/* Time column */}
            <div className="w-10 shrink-0 border-r border-gray-200 bg-white sticky left-0 z-20">
              {timeSlots.map((mins, i) => (
                <div key={mins} style={{ height: CELL_H }}
                  className="flex items-start justify-end pr-1 border-t border-gray-100">
                  {mins % 60 === 0 && (
                    <span className="text-[9px] text-gray-400 leading-none mt-0.5">
                      {minutesToTime(mins)}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {DAYS_ORDER.map(day => (
              <div key={day} className="flex-1 min-w-[64px] border-r border-gray-100 relative">
                {/* Day header */}
                <div className="sticky top-0 bg-white z-10 text-center py-1 border-b border-gray-200">
                  <p className="text-[10px] font-semibold text-gray-500">{DAY_LABELS[day].slice(0, 3).toUpperCase()}</p>
                </div>

                {/* Cells */}
                <div className="relative">
                  {timeSlots.map(mins => (
                    <DroppableCell
                      key={`${day}-${mins}`}
                      id={`${day}-${mins}`}
                      isOccupied={occupiedMap.has(slotKey(day, mins))}
                      isUnavailable={didiUnavailMap.has(slotKey(day, mins))}
                    />
                  ))}

                  {/* Lesson cards (absolutely positioned) */}
                  {gridSlots.filter(gs => gs.day === day).map(gs => {
                    const student = studentMap[gs.studentId]
                    if (!student) return null
                    const color = colorMap[gs.studentId]
                    const topOffset = ((gs.startMins - HOUR_START * 60) / STEP) * CELL_H
                    const height = (gs.durationMins / STEP) * CELL_H - 2

                    return (
                      <div
                        key={gs.id}
                        style={{ position: 'absolute', top: topOffset, left: 0, right: 0, height }}
                      >
                        <DraggableCard
                          slot={gs}
                          student={student}
                          color={color}
                          height={height}
                        />
                        {/* Remove button */}
                        <button
                          onClick={() => removeSlot(gs.id)}
                          className="absolute top-0.5 right-1 text-[10px] text-gray-400 hover:text-red-500 z-20 leading-none"
                          title="Αφαίρεση"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeSlot && activeStudent && (
            <div
              style={{ height: (activeSlot.durationMins / STEP) * CELL_H - 2, width: 80 }}
              className={`rounded-lg px-1.5 py-1 ${colorMap[activeSlot.studentId]?.light} border ${colorMap[activeSlot.studentId]?.border} shadow-xl opacity-90`}
            >
              <p className="text-[10px] font-bold truncate text-gray-800">{activeStudent.name}</p>
              <p className="text-[9px] text-gray-500">{minutesToTime(activeSlot.startMins)}</p>
            </div>
          )}
        </DragOverlay>
      </div>
    </DndContext>
  )
}
