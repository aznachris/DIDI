import { getStudents, getSlots, getLessons } from '@/lib/data'
import { isoDate, weekStart, addDays } from '@/lib/utils'
import WeekCalendar from './WeekCalendar'

export default async function CalendarPage() {
  const today = isoDate(new Date())
  const wStart = isoDate(weekStart(today))

  // Load current + next month lessons
  const ym1 = today.slice(0, 7)
  const ym2 = addDays(today, 30).slice(0, 7)
  const [students, slots, lessons1, lessons2] = await Promise.all([
    getStudents(),
    getSlots(),
    getLessons(ym1),
    getLessons(ym2),
  ])

  const lessons = ym1 === ym2 ? lessons1 : [...lessons1, ...lessons2]

  return (
    <WeekCalendar
      students={students}
      slots={slots}
      lessons={lessons}
      today={today}
      initialWeekStart={wStart}
    />
  )
}
