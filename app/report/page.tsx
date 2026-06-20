import { getStudents, getLessons } from '@/lib/data'
import ReportClient from './ReportClient'

export default async function ReportPage() {
  const today = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const [students, lessons] = await Promise.all([
    getStudents(),
    getLessons(today),
  ])
  return <ReportClient students={students} initialLessons={lessons} initialMonth={today} />
}
