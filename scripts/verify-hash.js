const b = require('bcryptjs')
const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf-8')
const match = env.match(/AUTH_PASSWORD_HASH=(.+)/)
const hash = match?.[1]?.trim()

console.log('Hash from .env.local:', hash)
b.compare('didi2026', hash).then(r => console.log('Password match:', r))
