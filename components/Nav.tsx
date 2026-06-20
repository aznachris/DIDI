'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const links = [
  { href: '/', label: 'Ημερολόγιο', icon: '📅' },
  { href: '/students', label: 'Μαθητές', icon: '👤' },
  { href: '/builder', label: 'Builder', icon: '✨' },
  { href: '/report', label: 'Αναφορά', icon: '💶' },
]

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  if (pathname === '/login') return null

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 safe-area-pb">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${
              pathname === l.href ? 'text-indigo-600' : 'text-gray-400'
            }`}
          >
            <span className="text-xl">{l.icon}</span>
            <span className="text-[10px] font-medium">{l.label}</span>
          </Link>
        ))}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-gray-400"
        >
          <span className="text-xl">🚪</span>
          <span className="text-[10px] font-medium">Έξοδος</span>
        </button>
      </div>
    </nav>
  )
}
