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
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="el">
      <body className={`${geist.className} bg-gray-50 min-h-screen`}>
        <Nav />
        <main className="pb-20">{children}</main>
      </body>
    </html>
  )
}
