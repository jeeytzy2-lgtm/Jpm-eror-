import { getOrderStatus, cancelOrder, canPoll } from './rumahotp.js'
import { getTransaction } from './pakasir.js'
import { saveNokosDB, getNokosUser } from './nokosDB.js'

const formatRupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const OTP_TIMEOUT = 15 * 60 * 1000        // auto refund kalau OTP tidak masuk
const EXPIRE_GRACE = 60 * 60 * 1000       // toleransi cek Pakasir sebelum deposit dianggap hangus
const MAX_CANCEL_FAIL = 12                // percobaan cancel ke provider sebelum refund paksa
const CANCELED = ['canceled', 'cancel', 'cancelled', 'refunded', 'expired']

export const info = { startedAt: 0, depTick: 0, otpTick: 0, lastOtpError: '', lastDepError: '' }

// Selalu pakai socket terbaru (socket berganti tiap reconnect)
const send = (jid, text) => {
  const s = global.nokosSock
  return s ? s.sendMessage(jid, { text }).catch((e) => console.log('[ CHECKER ] gagal kirim pesan:', e?.message)) : Promise.resolve()
}
const notifyOwner = (text) => Promise.all(
  (global.owner || []).map(n => send(String(n).replace(/\D/g, '') + '@s.whatsapp.net', text))
)

function removePending(orderId) {
  const arr = global.nokosDB.pendingOtps
  const i = arr.findIndex(x => x.orderId === orderId)
  if (i === -1) return false      // sudah diproses pihak lain -> jangan proses dobel
  arr.splice(i, 1)
  return true
}

// Refund idempotent: hanya yang berhasil "mengambil" entri pending yang boleh mengembalikan saldo.
export function refundPending(p, text) {
  if (!removePending(p.orderId)) return false
  const order = global.nokosDB.orders.find(o => o.trxId === p.orderId)
  if (order && order.status !== 'pending') { saveNokosDB(); return false }
  if (order) order.status = 'canceled'
  getNokosUser(p.jid).saldo += p.price
  saveNokosDB()
  if (text) send(p.jid, text)
  return true
}

// Batalkan di provider. True kalau provider mengonfirmasi pembatalan (langsung atau lewat cek status).
export async function cancelAtProvider(orderId) {
  const c = await cancelOrder(orderId)
  if (c && c.success) return true
  const s = await getOrderStatus(orderId)
  const st = (s?.data?.status || '').toLowerCase()
  return !!(s && s.success && CANCELED.includes(st))
}

// ---------- DEPOSIT (Pakasir) ----------
let depBusy = false
export async function tickDeposits() {
  if (depBusy) return            // cegah tick tumpang tindih -> saldo tidak bisa masuk dobel
  depBusy = true
  try {
    info.depTick = Date.now()
    let changed = false
    for (const dep of (global.nokosDB.deposits || [])) {
      if (dep.status !== 'pending') continue

      // deposit lama (RumahOTP) sudah tidak dicek lagi
      if (dep.gateway !== 'pakasir') {
        if (Date.now() > dep.expiredAt) { dep.status = 'expired'; changed = true }
        continue
      }

      const res = await getTransaction(dep.refId, dep.amount)
      if (dep.status !== 'pending') continue
      const tx = res.success ? res.data?.transaction : null
      const st = (tx?.status || '').toLowerCase()
      if (!res.success && res.status !== 404) {
        const err = `${dep.refId}: HTTP ${res.status || '-'} ${res.message}`
        if (info.lastDepError !== err) console.log('[ DEPOSIT ] gagal cek Pakasir:', err)
        info.lastDepError = err
      }

      if (st === 'completed') {
        if (tx.order_id !== dep.refId || Number(tx.amount) !== Number(dep.amount)) {
          dep.status = 'mismatch'; changed = true
          console.log('[ DEPOSIT ] Data Pakasir tidak cocok:', dep.refId)
          await notifyOwner(`⚠️ Deposit ${dep.refId} status completed tapi data tidak cocok. Cek manual.`)
          continue
        }
        dep.status = 'success'; dep.paidAt = Date.now()
        const user = getNokosUser(dep.jid)
        user.saldo += dep.amount
        changed = true
        saveNokosDB()            // simpan DULU sebelum kirim pesan
        console.log(`[ DEPOSIT ] ${dep.refId} lunas, saldo +${dep.amount}`)
        await send(dep.jid, `✅ *DEPOSIT BERHASIL!*\nNominal: ${formatRupiah(dep.amount)}\nID: ${dep.refId}\nSaldo sekarang: ${formatRupiah(user.saldo)}`)
      } else if (['canceled', 'cancelled', 'failed'].includes(st)) {
        dep.status = 'canceled'; changed = true
      } else if (Date.now() > dep.expiredAt && (tx || Date.now() > dep.expiredAt + EXPIRE_GRACE)) {
        // hangus hanya setelah Pakasir dicek (atau API error lebih dari 1 jam)
        dep.status = 'expired'; changed = true
      }
    }
    if (changed) saveNokosDB()
  } catch (e) {
    console.error('[ CHECKER DEPOSIT ]', e)
  } finally {
    depBusy = false
  }
}

// ---------- OTP (RumahOTP) ----------
const validCode = (v) => { const s = (v ?? '').toString().trim(); return s && s !== '-' ? s : null }

function extractOtp(data, status) {
  const code = validCode(data.otp_code)
  if (code) return code
  // cadangan: kalau otp_code kosong tapi pesan SMS sudah ada, ambil angkanya
  if (status === 'received' || status === 'completed') {
    const msg = validCode(data.otp_msg)
    const mm = msg && msg.match(/\b\d{3}[-\s]\d{3}\b|\b\d{4,8}\b/)
    if (mm) return mm[0]
  }
  return null
}

// Cek SATU order. background=true dipakai checker (hormati batas request), false dipakai tombol "Cek OTP".
// Hasil: 'delivered' | 'refunded' | 'waiting' | 'error' | 'skipped' | 'done'
export async function pollOrder(p, background = true) {
  if (!global.nokosDB.pendingOtps.includes(p)) return 'done'
  if (background && !canPoll()) return 'skipped'
  p.lastCheck = Date.now()

  const res = await getOrderStatus(p.orderId)
  if (!global.nokosDB.pendingOtps.includes(p)) return 'done'

  const data = res && res.success && res.data ? res.data : null
  const status = (data?.status || '').toLowerCase()

  if (data) {
    if (p.lastStatus !== status) { console.log(`[ OTP ] ${p.orderId}: ${p.lastStatus || '-'} -> ${status || '(kosong)'}`); p.lastStatus = status }
  } else {
    const err = `${p.orderId}: HTTP ${res?.status || '-'} ${res?.message || 'respons tidak valid'}`
    if (info.lastOtpError !== err) console.log('[ OTP ] gagal cek status:', err)
    info.lastOtpError = err
  }

  const otp = data ? extractOtp(data, status) : null
  const msg = data ? validCode(data.otp_msg) : null

  if (otp) {
    if (removePending(p.orderId)) {
      const order = global.nokosDB.orders.find(o => o.trxId === p.orderId)
      if (order) order.status = 'success'
      saveNokosDB()
      console.log(`[ OTP ] ${p.orderId}: kode diterima, dikirim ke ${p.jid}`)
      await send(p.jid, `🎉 *KODE OTP DITERIMA!*\nOrder: ${p.orderId}\nNomor: ${data.phone_number}\nKode OTP: *${otp}*` + (msg ? `\n\nPesan:\n${msg.slice(0, 300)}` : ''))
    }
    return 'delivered'
  }

  if (data && status === 'completed') {
    // provider bilang selesai tapi kode tidak terbaca: jangan direfund (nomor sudah terpakai), minta user hubungi owner
    if (removePending(p.orderId)) {
      const order = global.nokosDB.orders.find(o => o.trxId === p.orderId)
      if (order) order.status = 'success'
      saveNokosDB()
      await send(p.jid, `⚠️ Order ${p.orderId} sudah selesai di provider tetapi kode tidak terbaca oleh bot. Hubungi owner dan kirim Order ID ini.`)
      await notifyOwner(`⚠️ Order ${p.orderId} (${p.jid}) completed tanpa kode OTP terbaca. Cek dashboard RumahOTP.`)
    }
    return 'delivered'
  }

  if (data && CANCELED.includes(status)) {
    refundPending(p, `❌ *PESANAN DIBATALKAN PROVIDER*\nSaldo ${formatRupiah(p.price)} dikembalikan.`)
    return 'refunded'
  }

  if (Date.now() - p.startTime > OTP_TIMEOUT) {
    const ok = await cancelAtProvider(p.orderId)
    if (!global.nokosDB.pendingOtps.includes(p)) return 'done'
    const text = `⚠️ *WAKTU HABIS - AUTO REFUND*\nOrder: ${p.orderId}\nSaldo ${formatRupiah(p.price)} dikembalikan.`
    if (ok) { refundPending(p, text); return 'refunded' }
    p.cancelFail = (p.cancelFail || 0) + 1
    if (p.cancelFail >= MAX_CANCEL_FAIL) {
      refundPending(p, text)
      await notifyOwner(`⚠️ Order ${p.orderId} direfund paksa (provider tidak konfirmasi cancel). Cek manual di dashboard RumahOTP.`)
      return 'refunded'
    }
  }

  return data ? 'waiting' : 'error'
}

// Tiap tick hanya 1 order yang dicek (yang paling lama belum dicek, order kedaluwarsa didahulukan),
// supaya total request ke RumahOTP tetap di bawah batas 5 request / 10 detik.
let otpBusy = false
export async function tickOtps() {
  if (otpBusy) return
  otpBusy = true
  try {
    info.otpTick = Date.now()
    const list = [...(global.nokosDB.pendingOtps || [])]
    if (!list.length) return
    const now = Date.now()
    const late = (p) => (now - p.startTime > OTP_TIMEOUT ? 1 : 0)
    list.sort((a, b) => late(b) - late(a) || (a.lastCheck || 0) - (b.lastCheck || 0))
    await pollOrder(list[0], true)
  } catch (e) {
    console.error('[ CHECKER OTP ]', e)
  } finally {
    otpBusy = false
  }
}

export function checkerInfo() {
  return {
    running: !!timers,
    startedAt: info.startedAt, depTick: info.depTick, otpTick: info.otpTick,
    lastOtpError: info.lastOtpError, lastDepError: info.lastDepError,
    pendingOtps: (global.nokosDB.pendingOtps || []).length,
    pendingDeposits: (global.nokosDB.deposits || []).filter(d => d.status === 'pending').length
  }
}

// Panggil SEKALI saat koneksi 'open'. Aman dipanggil ulang setelah reconnect (interval tidak dobel).
let timers = null
export function startNokosChecker(sock) {
  global.nokosSock = sock
  if (timers) return
  info.startedAt = Date.now()
  timers = [setInterval(tickDeposits, 5000), setInterval(tickOtps, 3000)]
  console.log('[ CHECKER ] Pengecek deposit & OTP aktif')
}