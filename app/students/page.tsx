import { getStudents } from '@/lib/data'
import StudentsClient from './StudentsClient'

export default async function StudentsPage() {
  const students = await getStudents()
  return <StudentsClient initialStudents={students} />
}
