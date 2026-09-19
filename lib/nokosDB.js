import fs from 'fs'
import path from 'path'

const DB_DIR = './database'
const DB_FILE = path.join(DB_DIR, 'nokos.json')

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const def = { users: {}, deposits: [], orders: [], pendingOtps: [] }
    fs.writeFileSync(DB_FILE, JSON.stringify(def, null, 2))
    return def
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
  } catch (e) {
    return { users: {}, deposits: [], orders: [], pendingOtps: [] }
  }
}

if (!global.nokosDB) global.nokosDB = loadDB()

export function saveNokosDB() {
  const tmp = DB_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(global.nokosDB, null, 2))
  fs.renameSync(tmp, DB_FILE)
}

export function getNokosUser(jid) {
  if (!global.nokosDB.users[jid]) {
    global.nokosDB.users[jid] = { saldo: 0, joined: new Date().toLocaleDateString('id-ID') }
    saveNokosDB()
  }
  return global.nokosDB.users[jid]
}