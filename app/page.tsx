import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import CalendarPage from './calendar/CalendarPage'

export default async function Home() {
  if (!(await getSession())) redirect('/login')
  return <CalendarPage />
}
