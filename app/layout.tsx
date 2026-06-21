import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Didi Scheduler',
  description: 'Πρόγραμμα μαθημάτων & οικονομικά',
}

export const viewport: Viewport = {
  themeColor: '#1a0d00',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className={geist.className} style={{ background: 'var(--bg)', minHeight: '100svh' }}>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  )
}
