import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth'

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const address = req.nextUrl.searchParams.get('address') ?? ''
  if (!address.trim()) return NextResponse.json({ found: false })

  async function tryGeocode(q: string) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=gr&addressdetails=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'DidiScheduler/1.0 (private school scheduler)' } })
    return res.json()
  }

  // First try as-is, then with "Αθήνα" appended
  let data = await tryGeocode(address)
  if (!data || data.length === 0) {
    if (!address.toLowerCase().includes('αθήνα') && !address.toLowerCase().includes('athina') && !address.toLowerCase().includes('athens')) {
      data = await tryGeocode(address + ', Αθήνα')
    }
  }

  if (!data || data.length === 0) return NextResponse.json({ found: false })

  const result = data[0]
  const addr = result.address ?? {}
  const neighborhood = addr.suburb ?? addr.neighbourhood ?? addr.city_district ?? addr.quarter ?? ''
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? ''
  const locationLabel = [neighborhood, city].filter(Boolean).join(', ')

  return NextResponse.json({
    found: true,
    lat: parseFloat(result.lat),
    lng: parseFloat(result.lon),
    locationLabel,
    displayName: result.display_name,
  })
}
