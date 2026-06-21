'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const links = [
  {
    href: '/',
    label: 'Πρόγραμμα',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={active ? '#10b981' : '#a8a29e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/students',
    label: 'Μαθητές',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={active ? '#10b981' : '#a8a29e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4"/><path d="M4 21v-2a6 6 0 0 1 12 0v2"/>
      </svg>
    ),
  },
  {
    href: '/builder',
    label: 'Builder',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={active ? '#10b981' : '#a8a29e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    href: '/report',
    label: 'Αναφορά',
    icon: (active: boolean) => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke={active ? '#10b981' : '#a8a29e'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
      </svg>
    ),
  },
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
    <nav style={{ background: 'var(--nav-bg)' }} className="fixed bottom-0 left-0 right-0 z-40">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
        {links.map(l => {
          const active = pathname === l.href
          return (
            <Link key={l.href} href={l.href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all"
              style={{ opacity: active ? 1 : 0.85 }}
            >
              {l.icon(active)}
              <span className="text-[10px] font-semibold" style={{ color: active ? '#10b981' : '#a8a29e' }}>
                {l.label}
              </span>
            </Link>
          )
        })}
        <button onClick={handleLogout}
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#a8a29e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span className="text-[10px] font-semibold" style={{ color: '#a8a29e' }}>Έξοδος</span>
        </button>
      </div>
    </nav>
  )
}
