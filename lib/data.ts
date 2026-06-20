import { readBlob, writeBlob, lessonsBlobName } from './blob'
import type { Student, RecurringSlot, Lesson, DidiBlock, StudentsBlob, SlotsBlob, LessonsBlob, DidiBlocksBlob } from './types'

export async function getDidiBlocks(): Promise<DidiBlock[]> {
  const data = await readBlob<DidiBlocksBlob>('didi-blocks.json', { blocks: [] })
  return data.blocks
}

export async function saveDidiBlocks(blocks: DidiBlock[]): Promise<void> {
  await writeBlob<DidiBlocksBlob>('didi-blocks.json', { blocks })
}

export { readBlob as getBlobOrDefault }

// ── Students ──────────────────────────────────────────────
export async function getStudents(): Promise<Student[]> {
  const data = await readBlob<StudentsBlob>('students.json', { students: [] })
  return data.students
}

export async function saveStudents(students: Student[]): Promise<void> {
  await writeBlob<StudentsBlob>('students.json', { students })
}

// ── Recurring Slots ───────────────────────────────────────
export async function getSlots(): Promise<RecurringSlot[]> {
  const data = await readBlob<SlotsBlob>('slots.json', { slots: [] })
  return data.slots
}

export async function saveSlots(slots: RecurringSlot[]): Promise<void> {
  await writeBlob<SlotsBlob>('slots.json', { slots })
}

// ── Lessons ───────────────────────────────────────────────
export async function getLessons(yearMonth: string): Promise<Lesson[]> {
  const data = await readBlob<LessonsBlob>(lessonsBlobName(yearMonth), { lessons: [] })
  return data.lessons
}

export async function saveLessons(yearMonth: string, lessons: Lesson[]): Promise<void> {
  await writeBlob<LessonsBlob>(lessonsBlobName(yearMonth), { lessons })
}

export async function upsertLesson(lesson: Lesson): Promise<void> {
  const ym = lesson.date.slice(0, 7) // "YYYY-MM"
  const lessons = await getLessons(ym)
  const idx = lessons.findIndex(l => l.id === lesson.id)
  if (idx >= 0) lessons[idx] = lesson
  else lessons.push(lesson)
  await saveLessons(ym, lessons)
}
