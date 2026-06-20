import { getStudents, getSlots, getDidiBlocks } from '@/lib/data'
import BuilderClient from './BuilderClient'

export default async function BuilderPage() {
  const [students, slots, didiBlocks] = await Promise.all([
    getStudents(),
    getSlots(),
    getDidiBlocks(),
  ])
  return <BuilderClient students={students} existingSlots={slots} didiBlocks={didiBlocks} />
}
