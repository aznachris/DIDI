// node scripts/seed.js
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR)

function uid() { return crypto.randomUUID() }

const students = [
  {
    id: uid(), name: 'Μαρία Παπαδοπούλου', active: true,
    address: 'Κεφαληνίας 20, Αθήνα',
    lat: 37.9920, lng: 23.7380,
    ratePerHour: 30, level: 'C2', ageGroup: 'adult',
    sessionsPerWeek: 4, sessionDurationMins: 60,
    notes: 'Proficiency preparation',
    preferred: [
      { day: 'TUE', from: '17:00', to: '20:00' },
      { day: 'THU', from: '17:00', to: '20:00' },
    ],
    unavailable: [
      { day: 'MON', from: '08:00', to: '22:00' },
      { day: 'WED', from: '08:00', to: '22:00' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Γιώργης Νικολάου', active: true,
    address: 'Ζακύνθου 8, Αθήνα',
    lat: 37.9935, lng: 23.7360,
    ratePerHour: 25, level: 'B1', ageGroup: 'teen',
    sessionsPerWeek: 2, sessionDurationMins: 60,
    notes: 'Lower, σχολείο τελειώνει 15:00',
    preferred: [
      { day: 'MON', from: '16:00', to: '19:00' },
      { day: 'WED', from: '16:00', to: '19:00' },
    ],
    unavailable: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Ελένη Σταύρου', active: true,
    address: 'Φωκίωνος Νέγρη 5, Αθήνα',
    lat: 37.9900, lng: 23.7420,
    ratePerHour: 25, level: 'A2', ageGroup: 'kid',
    sessionsPerWeek: 2, sessionDurationMins: 45,
    notes: 'Δημοτικό, χρειάζεται πολύ παιχνίδι',
    preferred: [
      { day: 'TUE', from: '15:00', to: '18:00' },
      { day: 'FRI', from: '15:00', to: '18:00' },
    ],
    unavailable: [
      { day: 'SAT', from: '08:00', to: '22:00' },
      { day: 'SUN', from: '08:00', to: '22:00' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Κώστας Δημητρίου', active: true,
    address: 'Αχαρνών 150, Αθήνα',
    lat: 37.9980, lng: 23.7340,
    ratePerHour: 28, level: 'B2', ageGroup: 'adult',
    sessionsPerWeek: 3, sessionDurationMins: 60,
    notes: 'Χρειάζεται business English',
    preferred: [
      { day: 'MON', from: '19:00', to: '21:00' },
      { day: 'WED', from: '19:00', to: '21:00' },
      { day: 'FRI', from: '19:00', to: '21:00' },
    ],
    unavailable: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Σοφία Αντωνίου', active: true,
    address: 'Δροσοπούλου 30, Αθήνα',
    lat: 37.9945, lng: 23.7400,
    ratePerHour: 25, level: 'A1', ageGroup: 'kid',
    sessionsPerWeek: 2, sessionDurationMins: 45,
    notes: 'Αρχάρια, 8 χρονών',
    preferred: [
      { day: 'TUE', from: '16:00', to: '18:00' },
      { day: 'THU', from: '16:00', to: '18:00' },
    ],
    unavailable: [
      { day: 'MON', from: '08:00', to: '16:00' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Νίκος Παπαγεωργίου', active: true,
    address: 'Πατησίων 80, Αθήνα',
    lat: 37.9960, lng: 23.7310,
    ratePerHour: 30, level: 'C1', ageGroup: 'teen',
    sessionsPerWeek: 3, sessionDurationMins: 60,
    notes: 'Advanced, στόχος ECPE',
    preferred: [
      { day: 'MON', from: '17:00', to: '20:00' },
      { day: 'WED', from: '17:00', to: '20:00' },
      { day: 'FRI', from: '17:00', to: '20:00' },
    ],
    unavailable: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Άννα Κωνσταντίνου', active: true,
    address: 'Λαρίσης 12, Αθήνα',
    lat: 37.9905, lng: 23.7295,
    ratePerHour: 25, level: 'B1', ageGroup: 'kid',
    sessionsPerWeek: 2, sessionDurationMins: 60,
    notes: 'Γυμνάσιο',
    preferred: [
      { day: 'THU', from: '16:00', to: '19:00' },
      { day: 'SAT', from: '10:00', to: '13:00' },
    ],
    unavailable: [
      { day: 'TUE', from: '08:00', to: '22:00' },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: uid(), name: 'Θανάσης Γεωργίου', active: true,
    address: 'Κυψέλης 40, Αθήνα',
    lat: 37.9912, lng: 23.7368,
    ratePerHour: 25, level: 'A2', ageGroup: 'teen',
    sessionsPerWeek: 2, sessionDurationMins: 60,
    notes: 'Λύκειο, αδύναμος στη γραμματική',
    preferred: [
      { day: 'MON', from: '15:00', to: '18:00' },
      { day: 'WED', from: '15:00', to: '18:00' },
    ],
    unavailable: [],
    createdAt: new Date().toISOString(),
  },
]

const out = path.join(DATA_DIR, 'students.json')
fs.writeFileSync(out, JSON.stringify({ students }, null, 2), 'utf-8')
console.log(`✓ Seeded ${students.length} students → ${out}`)

const weeklyHours = students.reduce((s, st) => s + st.sessionsPerWeek * st.sessionDurationMins / 60, 0)
const weeklyIncome = students.reduce((s, st) => s + st.sessionsPerWeek * st.sessionDurationMins / 60 * st.ratePerHour, 0)
console.log(`  Σύνολο: ${weeklyHours}h/εβδ · €${weeklyIncome.toFixed(0)}/εβδ · ~€${(weeklyIncome * 4.33).toFixed(0)}/μήνα`)
