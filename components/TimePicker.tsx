'use client'

interface Props {
  value: string   // "HH:mm"
  onChange: (val: string) => void
  className?: string
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8) // 8-22
const MINUTES = [0, 15, 30, 45]

export default function TimePicker({ value, onChange, className = '' }: Props) {
  const [hStr, mStr] = (value || '08:00').split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)

  function setH(newH: number) {
    onChange(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
  }
  function setM(newM: number) {
    onChange(`${String(h).padStart(2, '0')}:${String(newM).padStart(2, '0')}`)
  }

  const base = 'border border-slate-200 rounded-lg bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400 py-1.5 px-2'

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <select value={h} onChange={e => setH(Number(e.target.value))} className={base}>
        {HOURS.map(hh => (
          <option key={hh} value={hh}>{String(hh).padStart(2, '0')}</option>
        ))}
      </select>
      <span className="text-slate-400 text-sm font-bold">:</span>
      <select value={m} onChange={e => setM(Number(e.target.value))} className={base}>
        {MINUTES.map(mm => (
          <option key={mm} value={mm}>{String(mm).padStart(2, '0')}</option>
        ))}
      </select>
    </div>
  )
}
