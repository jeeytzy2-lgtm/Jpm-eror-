import QRCode from 'qrcode'
import { createQris, cancelTransaction } from '../lib/pakasir.js'
import { saveNokosDB } from '../lib/nokosDB.js'

const formatRupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

const MIN_DEPOSIT = 2000     // sesuaikan dengan batas minimal di proyek Pakasir kamu
const MAX_DEPOSIT = 5000000
const MAX_PENDING = 3        // maksimal tagihan aktif per user
const genRefId = () => 'DEP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase()

// Terima: 10000 | 10.000 | 10,000 | Rp10.000 | rp 10.000 | 10k | 10rb
function parseNominal(input) {
  let s = String(input || '').toLowerCase().replace(/\s+/g, '').replace(/^rp\.?/, '')
  let mult = 1
  if (/(k|rb|ribu)$/.test(s)) { mult = 1000; s = s.replace(/(k|rb|ribu)$/, '') }
  if (!/^\d+([.,]\d+)?$/.test(s)) return NaN
  if (mult === 1) s = s.replace(/[.,]/g, '')            // 10.000 / 10,000 -> 10000
  else s = s.replace(',', '.')                           // 1,5k -> 1.5k
  const n = Math.round(parseFloat(s) * mult)
  return Number.isFinite(n) ? n : NaN
}

const activeOf = (jid) => global.nokosDB.deposits.filter(d => d.jid === jid && d.status === 'pending' && d.gateway === 'pakasir' && Date.now() < d.expiredAt)

let handler = async (m, { sock, jid, text, isOwner }) => {
  const arg = (text || '').trim()

  // .depo batal  -> batalkan semua tagihan yang belum dibayar
  if (/^(batal|cancel)$/i.test(arg)) {
    const list = activeOf(jid)
    if (!list.length) return sock.sendMessage(jid, { text: 'ℹ️ Tidak ada tagihan yang menunggu pembayaran.' }, { quoted: m })
    for (const d of list) {
      await cancelTransaction(d.refId, d.amount)
      if (d.status === 'pending') d.status = 'canceled'
    }
    saveNokosDB()
    return sock.sendMessage(jid, { text: `✅ ${list.length} tagihan dibatalkan. Silakan buat deposit baru dengan .depo <nominal>` }, { quoted: m })
  }

  if (!arg) {
    const buttons = [5000, 10000, 15000, 20000].map(a => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: `${a / 1000}k`, id: `.depo ${a}` })
    }))
    return sock.sendButton(jid, {
      text: `💳 *ISI SALDO*\nKetik \`.depo <nominal>\` (contoh: .depo 10000 atau .depo 10k) atau pilih nominal cepat.\nMinimal ${formatRupiah(MIN_DEPOSIT)}.`,
      footer: toko.footer, buttons, bottom_sheet: false
    }, { quoted: m })
  }

  const amount = parseNominal(arg)
  if (!Number.isFinite(amount)) return sock.sendMessage(jid, { text: '❌ Nominal tidak valid. Contoh: .depo 10000 atau .depo 10k' }, { quoted: m })
  if (amount < MIN_DEPOSIT) return sock.sendMessage(jid, { text: `❌ Minimal deposit ${formatRupiah(MIN_DEPOSIT)}` }, { quoted: m })
  if (amount > MAX_DEPOSIT) return sock.sendMessage(jid, { text: `❌ Maksimal deposit ${formatRupiah(MAX_DEPOSIT)}` }, { quoted: m })

  const active = activeOf(jid)
  if (active.length >= MAX_PENDING) {
    return sock.sendButton(jid, {
      text: `⏳ Kamu masih punya ${active.length} tagihan yang belum dibayar.\nBayar dulu, tunggu expired, atau batalkan tagihan lama.`,
      footer: toko.footer,
      buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🗑️ Batalkan Tagihan Lama', id: '.depo batal' }) }],
      bottom_sheet: false
    }, { quoted: m })
  }

  await sock.sendMessage(jid, { text: '🔄 Membuat tagihan QRIS...' }, { quoted: m })

  const refId = genRefId()
  const res = await createQris(refId, amount)
  const pay = res.success ? res.data?.payment : null
  if (!pay || !pay.payment_number) {
    console.log('[ PAKASIR ] Gagal membuat tagihan | HTTP', res.status, '|', res.message, '|', JSON.stringify(res.data))
    const detail = isOwner ? `\n\n[Owner] ${res.message || 'respons tidak dikenal'} (HTTP ${res.status || '-'})` : ''
    return sock.sendMessage(jid, { text: '❌ Gagal membuat tagihan. Coba lagi sebentar, atau hubungi owner kalau terus berulang.' + detail }, { quoted: m })
  }

  const fee = Number(pay.fee) || 0
  const total = Number(pay.total_payment) || amount + fee
  const expiredAt = Date.parse(pay.expired_at) || (Date.now() + 15 * 60 * 1000)

  // Pakasir hanya mengirim QR *string*; gambarnya kita buat sendiri
  let qrImage
  try {
    qrImage = await QRCode.toBuffer(pay.payment_number, { width: 600, margin: 2, errorCorrectionLevel: 'M' })
  } catch (e) {
    console.error('[ QR ]', e)
    await cancelTransaction(refId, amount)
    return sock.sendMessage(jid, { text: '❌ Gagal membuat gambar QR. Coba lagi.' }, { quoted: m })
  }

  global.nokosDB.deposits.push({
    refId, jid, amount, fee, total,
    status: 'pending', method: 'QRIS', gateway: 'pakasir',
    date: new Date().toLocaleDateString('id-ID'), createdAt: Date.now(), expiredAt
  })
  saveNokosDB()

  await sock.sendMessage(jid, {
    image: qrImage,
    caption: `✅ *TAGIHAN DIBUAT*\n\nID: ${refId}\nTotal Bayar: ${formatRupiah(total)}\nSaldo Masuk: ${formatRupiah(amount)}\nExpired: ${new Date(expiredAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB\n\nBayar sesuai *Total Bayar* (sudah termasuk biaya layanan). Saldo masuk otomatis setelah dibayar.`
  }, { quoted: m })
}

handler.command = ['depo', 'deposit']
handler.tags = ['nokos']
handler.private = true
export default handler