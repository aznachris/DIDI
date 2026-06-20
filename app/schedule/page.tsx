import { getStudents, getSlots } from '@/lib/data'
import ScheduleClient from './ScheduleClient'

export default async function SchedulePage() {
  const [students, slots] = await Promise.all([getStudents(), getSlots()])
  return <ScheduleClient students={students} initialSlots={slots} />
}
