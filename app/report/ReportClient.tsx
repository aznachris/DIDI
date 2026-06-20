'use client'

import { useState, useMemo } from 'react'
import type { Student, Lesson } from '@/lib/types'
import { formatMoney } from '@/lib/utils'

interface Props {
  students: Student[]
  initialLessons: Lesson[]
  initialMonth: string
}

const MONTH_NAMES = [
  'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος',
  'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος',
  'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος',
]

export default function ReportClient({ students, initialLessons, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [lessons, setLessons] = useState(initialLessons)
  const [loading, setLoading] = useState(false)

  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students])

  async function changeMonth(newMonth: string) {
    setMonth(newMonth)
    setLoading(true)
    const res = await fetch(`/api/report?month=${newMonth}`)
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

  const doneLessons = lessons.filter(l => l.status === 'done')
  const cancelledLessons = lessons.filter(l => l.status === 'cancelled_student' || l.status === 'cancelled_didi')
  const totalIncome = doneLessons.reduce((sum, l) => sum + l.amountCharged, 0)

  // Per-student summary
  const perStudent = useMemo(() => {
    const map: Record<string, { done: number; cancelled: number; income: number }> = {}
    for (const l of lessons) {
      if (!map[l.studentId]) map[l.studentId] = { done: 0, cancelled: 0, income: 0 }
      if (l.status === 'done') {
        map[l.studentId].done++
        map[l.studentId].income += l.amountCharged
      } else if (l.status === 'cancelled_student' || l.status === 'cancelled_didi') {
        map[l.studentId].cancelled++
      }
    }
    return Object.entries(map)
      .map(([studentId, stats]) => ({ studentId, ...stats }))
      .sort((a, b) => b.income - a.income)
  }, [lessons])

  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`

  return (
    <div className="p-4 max-w-2xl mx-auto">
      {/* Month nav */}
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
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
              <p className="text-2xl font-bold text-green-600">{formatMoney(totalIncome)}</p>
              <p className="text-xs text-gray-400 mt-1">Συνολικά έσοδα</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
              <p className="text-2xl font-bold text-indigo-600">{doneLessons.length}</p>
              <p className="text-xs text-gray-400 mt-1">Μαθήματα</p>
            </div>
            <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
              <p className="text-2xl font-bold text-red-400">{cancelledLessons.length}</p>
              <p className="text-xs text-gray-400 mt-1">Ακυρώσεις</p>
            </div>
          </div>

          {/* Per student */}
          <h2 className="text-sm font-semibold text-gray-500 mb-3">Ανά μαθητή</h2>
          <div className="space-y-2">
            {perStudent.map(({ studentId, done, cancelled, income }) => {
              const student = studentMap[studentId]
              return (
                <div key={studentId} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{student?.name ?? 'Άγνωστος'}</p>
                      <p className="text-xs text-gray-400">
                        {done} μαθ.{cancelled > 0 ? ` · ${cancelled} ακυρ.` : ''}
                      </p>
                    </div>
                    <p className="text-lg font-bold text-green-600">{formatMoney(income)}</p>
                  </div>
                </div>
              )
            })}
            {perStudent.length === 0 && (
              <p className="text-center text-gray-300 py-6">Δεν υπάρχουν δεδομένα</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
