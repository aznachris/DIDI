// node scripts/generate-password.js <password>
const bcrypt = require('bcryptjs')
const password = process.argv[2]
if (!password) { console.error('Usage: node scripts/generate-password.js <password>'); process.exit(1) }
bcrypt.hash(password, 10).then(hash => {
  console.log('\nAdd this to .env.local:\n')
  console.log(`AUTH_PASSWORD_HASH=${hash}\n`)
})
