interface NominatimResult {
  lat: string
  lon: string
  display_name: string
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gr`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'DidiScheduler/1.0 (private school scheduler)',
        'Accept-Language': 'el,en',
      },
      // Nominatim asks for max 1 req/sec — for our use case (save student) this is fine
    })
    if (!res.ok) return null
    const data: NominatimResult[] = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}
