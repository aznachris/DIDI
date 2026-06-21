import { getStudents, getLessons, getSlots } from '@/lib/data'
import ReportClient from './ReportClient'
import { isoDate } from '@/lib/utils'

export default async function ReportPage() {
  const today = isoDate(new Date()).slice(0, 7)
  const [students, lessons, slots] = await Promise.all([
    getStudents(),
    getLessons(today),
    getSlots(),
  ])
  return <ReportClient students={students} slots={slots} initialLessons={lessons} initialMonth={today} />
}
