import { readFileSync } from 'fs'

// ── Config ────────────────────────────────────────────────
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const DAY_LABELS = { MON: 'Δευτέρα', TUE: 'Τρίτη', WED: 'Τετάρτη', THU: 'Πέμπτη', FRI: 'Παρασκευή', SAT: 'Σάββατο', SUN: 'Κυριακή' }
const DAY_INDEX  = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 }
const DAY_START  = 8 * 60
const DAY_END    = 22 * 60
const AVG_SPEED  = 20
const MIN_TRAVEL = 10
const DIDI_HOME  = { lat: 37.9928, lng: 23.7358 }

// ── Helpers ───────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.asin(Math.sqrt(a))
}
function travelMins(dist) { return Math.max(MIN_TRAVEL, Math.ceil(dist / AVG_SPEED * 60)) }
function toTime(mins) { return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}` }
function toMins(t) { const [h,m]=t.split(':').map(Number); return h*60+m }
function dayGap(a, b) { return Math.abs(DAY_INDEX[a] - DAY_INDEX[b]) }

function isUnavail(s, day, from, to) {
  return s.unavailable.some(w => w.day===day && toMins(w.from)<to && toMins(w.to)>from)
}
function prefWindow(s, day) {
  const w = s.preferred.find(p => p.day===day)
  return w ? { from: toMins(w.from), to: toMins(w.to) } : null
}
function distBetween(a, b) {
  if (!a.lat||!a.lng||!b.lat||!b.lng) return 2
  return haversine(a.lat, a.lng, b.lat, b.lng)
}

// ── Phase 1: assign days ──────────────────────────────────
function assignDays(students) {
  const assignments = []
  const sorted = [...students].sort((a,b) => {
    const aDays = DAYS.filter(d => !isUnavail(a,d,DAY_START,DAY_END)).length
    const bDays = DAYS.filter(d => !isUnavail(b,d,DAY_START,DAY_END)).length
    return aDays - bDays
  })

  for (const s of sorted) {
    const minGap = s.minDaysBetweenSessions ?? 2

    for (let sess = 0; sess < s.sessionsPerWeek; sess++) {
      const usedDays = assignments.filter(a=>a.studentId===s.id).map(a=>a.day)

      function scoreDay(day, enforceGap) {
        if (usedDays.includes(day)) return null
        if (isUnavail(s, day, DAY_START, DAY_END)) return null
        if (enforceGap && usedDays.some(d => dayGap(d, day) < minGap)) return null

        const dayA = assignments.filter(a=>a.day===day)
        let score = 0
        if (s.preferred.some(p=>p.day===day)) score += 20
        if (dayA.length > 0) {
          const assigned = dayA.map(a=>students.find(st=>st.id===a.studentId)).filter(Boolean)
          const avgDist = assigned.reduce((sum,st)=>sum+distBetween(s,st), 0) / assigned.length
          score += Math.max(0, 15 - avgDist * 3)
        }
        score -= dayA.length * 2
        return score
      }

      let best = null, bestScore = -Infinity
      // Pass 1: with gap constraint
      for (const day of DAYS) {
        const sc = scoreDay(day, true)
        if (sc !== null && sc > bestScore) { bestScore = sc; best = day }
      }
      // Pass 2: relax gap if impossible
      if (!best) {
        bestScore = -Infinity
        for (const day of DAYS) {
          const sc = scoreDay(day, false)
          if (sc !== null && sc > bestScore) { bestScore = sc; best = day }
        }
      }
      if (best) assignments.push({ studentId: s.id, day: best, dur: s.sessionDurationMins, relaxed: !DAYS.filter(d => {
        if (usedDays.includes(d)) return false
        if (isUnavail(s, d, DAY_START, DAY_END)) return false
        if (usedDays.some(ud => dayGap(ud, d) < minGap)) return false
        return true
      }).length })
    }
  }
  return assignments
}

// ── Phase 2: nearest-neighbor per day ────────────────────
function routeDay(day, sessions) {
  const n = sessions.length
  const visited = new Array(n).fill(false)
  const route = []
  let curLat = DIDI_HOME.lat, curLng = DIDI_HOME.lng, curTime = DAY_START

  for (let step = 0; step < n; step++) {
    let bestIdx = -1, bestCost = Infinity, bestStart = 0
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue
      const { student, dur } = sessions[i]
      const dist = (student.lat&&student.lng) ? haversine(curLat,curLng,student.lat,student.lng) : 2
      const travel = travelMins(dist)
      const arrival = curTime + travel
      const pref = prefWindow(student, day)
      const earliest = pref ? Math.max(arrival, pref.from) : arrival
      const latest = pref ? pref.to - dur : DAY_END - dur
      if (isUnavail(student, day, earliest, earliest+dur)) continue
      if (earliest > latest || earliest+dur > DAY_END) continue
      const cost = earliest * 10 + dist * 3
      if (cost < bestCost) { bestCost = cost; bestIdx = i; bestStart = earliest }
    }
    if (bestIdx === -1) break
    const { student, dur } = sessions[bestIdx]
    visited[bestIdx] = true
    route.push({ student, startMins: bestStart, durationMins: dur })
    curLat = student.lat ?? curLat; curLng = student.lng ?? curLng
    curTime = bestStart + dur
  }
  return route
}

// ── Load data ─────────────────────────────────────────────
const { students } = JSON.parse(readFileSync('./data/students.json', 'utf8'))
const active = students.filter(s => s.active && s.sessionsPerWeek > 0)

console.log(`\n📚 ${active.length} μαθητές, σύνολο ${active.reduce((s,st)=>s+st.sessionsPerWeek,0)} sessions/εβδ`)
console.log('   Κανόνας απόστασης ανά μαθητή:')
for (const s of active) {
  console.log(`   · ${s.name}: ≥${s.minDaysBetweenSessions ?? 2} μέρες μεταξύ sessions`)
}

const assignments = assignDays(active)

// ── Per-day output ────────────────────────────────────────
const allRouted = []
for (const day of DAYS) {
  const daySessions = assignments
    .filter(a => a.day === day)
    .map(a => ({ student: active.find(s=>s.id===a.studentId), dur: a.dur }))
    .filter(ds => ds.student)

  if (daySessions.length === 0) continue
  const routed = routeDay(day, daySessions)
  allRouted.push(...routed.map(r => ({ ...r, day })))

  const dayIncome = routed.reduce((sum,r) => sum + r.student.ratePerHour * r.durationMins/60, 0)
  console.log(`\n📅 ${DAY_LABELS[day]} — ${routed.length} μαθήματα · €${dayIncome.toFixed(0)}`)
  console.log(`   🏠 Didi home`)

  let prevLat = DIDI_HOME.lat, prevLng = DIDI_HOME.lng
  for (const r of routed) {
    const dist = (r.student.lat&&r.student.lng) ? haversine(prevLat,prevLng,r.student.lat,r.student.lng) : null
    const travel = dist != null ? travelMins(dist) : '?'
    const pref = prefWindow(r.student, day)
    const inPref = pref && r.startMins >= pref.from && r.startMins+r.durationMins <= pref.to
    const prefTag = pref ? (inPref ? '✅' : '⚠️ εκτός προτ.') : '(χωρίς προτ.)'
    console.log(`   → [${travel}λ] ${toTime(r.startMins)}-${toTime(r.startMins+r.durationMins)} ${r.student.name} (${r.student.level}) ${prefTag}`)
    prevLat = r.student.lat ?? prevLat; prevLng = r.student.lng ?? prevLng
  }
}

// ── Gap validation ────────────────────────────────────────
console.log('\n━━━ Έλεγχος κανόνα απόστασης ━━━')
let gapViolations = 0
for (const s of active) {
  const minGap = s.minDaysBetweenSessions ?? 2
  const days = assignments.filter(a => a.studentId === s.id).map(a => a.day)
  if (days.length < 2) continue

  const violations = []
  for (let i = 0; i < days.length; i++) {
    for (let j = i+1; j < days.length; j++) {
      const gap = dayGap(days[i], days[j])
      if (gap < minGap) {
        violations.push(`${DAY_LABELS[days[i]]}↔${DAY_LABELS[days[j]]} (${gap} μέρες < ${minGap})`)
      }
    }
  }

  if (violations.length > 0) {
    console.log(`⚠️  ${s.name}: παραβίαση — ${violations.join(', ')}`)
    gapViolations++
  } else {
    const dayLabels = days.map(d => DAY_LABELS[d]).join(', ')
    const minActual = days.length > 1
      ? Math.min(...days.flatMap((d,i) => days.slice(i+1).map(d2 => dayGap(d, d2))))
      : Infinity
    console.log(`✅ ${s.name}: ${dayLabels} — ελάχ. απόσταση ${minActual === Infinity ? '—' : minActual} (≥${minGap})`)
  }
}

// ── Summary ───────────────────────────────────────────────
const routedIncome = allRouted.reduce((sum,r) => sum + r.student.ratePerHour * r.durationMins/60, 0)
const placed = allRouted.length
const needed = active.reduce((s,st)=>s+st.sessionsPerWeek, 0)

console.log(`\n💶 Σύνολο: €${routedIncome.toFixed(0)}/εβδ · ${placed}/${needed} sessions τοποθετήθηκαν`)
if (placed < needed) {
  console.log(`⚠️  ${needed - placed} sessions ΔΕΝ τοποθετήθηκαν (time window conflicts)`)
  for (const s of active) {
    const n = allRouted.filter(r => r.student.id === s.id).length
    if (n < s.sessionsPerWeek) console.log(`   ❌ ${s.name}: χρειάζεται ${s.sessionsPerWeek}, τοποθετήθηκαν ${n}`)
  }
}
if (gapViolations === 0) {
  console.log('✅ Κανένας κανόνας απόστασης δεν παραβιάστηκε')
} else {
  console.log(`⚠️  ${gapViolations} μαθητές με παραβίαση κανόνα απόστασης`)
}
