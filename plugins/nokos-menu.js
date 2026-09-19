import { getServices, getCountries, getOperators, createOrder, cancelOrder } from '../lib/rumahotp.js'
import { getNokosUser, saveNokosDB } from '../lib/nokosDB.js'
import { refundPending, cancelAtProvider } from '../lib/nokosChecker.js'

const formatRupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')
const paginate = (arr, size, page) => arr.slice((page - 1) * size, page * size)
const SAFE = /^[A-Za-z0-9_-]{1,64}$/     // id dari tombol/ketikan user harus aman sebelum dikirim ke provider
const toPage = (v) => Math.max(1, parseInt(v) || 1)
const validPrice = (n) => Number.isFinite(n) && n > 0

// Harga & stok SELALU diambil ulang dari provider. Harga di id tombol (.nokos op ... <harga>) tidak dipercaya,
// karena user bisa mengetik manual `.nokos op 1 2 1` untuk membeli seharga Rp 1.
async function findPriceItem(session, providerId, serverId) {
  const res = await getCountries(session.serviceId)
  if (!res.success || !Array.isArray(res.data)) return { error: 'provider' }
  const country = res.data.find(c => String(c.number_id) === String(session.countryId))
  if (!country) return { error: 'country' }
  const item = (country.pricelist || []).find(p => String(p.provider_id) === String(providerId) && String(p.server_id) === String(serverId))
  if (!item) return { error: 'item' }
  const margin = Number(global.nokosMargin) || 0
  return { country, item, price: parseInt(item.price) + margin, stock: parseInt(item.stock) }
}

let cachedServices = []
let cachedAt = 0
async function getServicesCached() {
  if (Date.now() - cachedAt < 5 * 60 * 1000 && cachedServices.length) return cachedServices
  const res = await getServices()
  if (res.success && Array.isArray(res.data)) { cachedServices = res.data; cachedAt = Date.now() }
  return cachedServices
}

let handler = async (m, { sock, jid, text }) => {
  const args = text ? text.trim().split(/\s+/) : []
  if (!global.nokosSession) global.nokosSession = {}
  if (!global.nokosSession[jid]) global.nokosSession[jid] = {}
  const session = global.nokosSession[jid]
  const user = getNokosUser(jid)
  const sub = args[0]

  // ===== LEVEL 1: LAYANAN =====
  if (!sub || sub === 'svc') {
    const page = sub === 'svc' ? toPage(args[1]) : 1
    const services = await getServicesCached()
    if (!services.length) return sock.sendMessage(jid, { text: '❌ Gagal memuat layanan dari provider.' }, { quoted: m })

    const totalPage = Math.ceil(services.length / 8)
    const paginated = paginate(services, 8, page)
    const buttons = paginated.map(s => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: `📱 ${s.service_name}`, id: `.nokos cty ${s.service_code} 1` })
    }))
    if (page > 1) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬅️ Prev', id: `.nokos svc ${page - 1}` }) })
    if (page < totalPage) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Next ➡️', id: `.nokos svc ${page + 1}` }) })

    return sock.sendButton(jid, {
      text: `📱 *KATALOG LAYANAN OTP*\nHalaman ${page}/${totalPage}`,
      footer: toko.footer, buttons, bottom_sheet: true, bottom_name: 'Layanan'
    }, { quoted: m })
  }

  // ===== LEVEL 2: NEGARA =====
  if (sub === 'cty') {
    const serviceId = args[1]
    const page = toPage(args[2])
    if (!SAFE.test(serviceId || '')) return sock.sendMessage(jid, { text: '❌ Layanan tidak valid, ulangi dari .nokos' }, { quoted: m })
    session.serviceId = serviceId

    const res = await getCountries(serviceId)
    if (!res.success || !res.data) return sock.sendMessage(jid, { text: '❌ Gagal memuat negara.' }, { quoted: m })

    const totalPage = Math.ceil(res.data.length / 8)
    const paginated = paginate(res.data, 8, page)
    const buttons = paginated.map(c => ({
      name: 'quick_reply',
      buttonParamsJson: JSON.stringify({ display_text: `${c.name} (${c.prefix})`, id: `.nokos stok ${c.number_id} 1` })
    }))
    if (page > 1) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬅️ Prev', id: `.nokos cty ${serviceId} ${page - 1}` }) })
    if (page < totalPage) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Next ➡️', id: `.nokos cty ${serviceId} ${page + 1}` }) })
    buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔙 Kembali', id: '.nokos svc 1' }) })

    return sock.sendButton(jid, {
      text: `🌎 *PILIH NEGARA*\nHalaman ${page}/${totalPage}`,
      footer: toko.footer, buttons, bottom_sheet: true, bottom_name: 'Negara'
    }, { quoted: m })
  }

  // ===== LEVEL 3: STOK/HARGA =====
  if (sub === 'stok') {
    const countryId = args[1]
    const page = toPage(args[2])
    if (!SAFE.test(countryId || '') || !session.serviceId) return sock.sendMessage(jid, { text: '❌ Sesi hilang, ulangi dari .nokos' }, { quoted: m })
    session.countryId = countryId

    const res = await getCountries(session.serviceId)
    if (!res.success || !res.data) return sock.sendMessage(jid, { text: '❌ Gagal memuat stok.' }, { quoted: m })

    const countryData = res.data.find(c => c.number_id == countryId)
    if (!countryData) return sock.sendMessage(jid, { text: '❌ Negara tidak ditemukan, ulangi dari .nokos' }, { quoted: m })
    session.countryName = countryData.name

    const margin = global.nokosMargin || 0
    let stocks = (countryData.pricelist || []).slice().sort((a, b) => parseInt(b.stock) - parseInt(a.stock))
    const totalPage = Math.ceil(stocks.length / 8)
    const paginated = paginate(stocks, 8, page)

    const buttons = paginated.map(p => {
      const finalPrice = parseInt(p.price) + margin
      const stok = parseInt(p.stock)
      return {
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({
          display_text: stok > 0 ? `💰 ${formatRupiah(finalPrice)} | Stok: ${stok}` : `❌ ${formatRupiah(finalPrice)} (Habis)`,
          id: stok > 0 ? `.nokos op ${p.provider_id} ${p.server_id} ${finalPrice}` : '.nokos habis'
        })
      }
    })
    if (page > 1) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '⬅️ Prev', id: `.nokos stok ${countryId} ${page - 1}` }) })
    if (page < totalPage) buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: 'Next ➡️', id: `.nokos stok ${countryId} ${page + 1}` }) })
    buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔙 Kembali', id: `.nokos cty ${session.serviceId} 1` }) })

    return sock.sendButton(jid, {
      text: `📦 *STOK - ${countryData.name}*\nHalaman ${page}/${totalPage}`,
      footer: toko.footer, buttons, bottom_sheet: true, bottom_name: 'Stok'
    }, { quoted: m })
  }

  if (sub === 'habis') return sock.sendMessage(jid, { text: '❌ Stok baru saja habis, pilih yang lain.' }, { quoted: m })

  // ===== LEVEL 4: OPERATOR =====
  if (sub === 'op') {
    const [, providerId, serverId] = args          // args[3] (harga dari tombol) sengaja diabaikan
    if (!SAFE.test(providerId || '') || !SAFE.test(serverId || '')) return sock.sendMessage(jid, { text: '❌ Pilihan tidak valid, ulangi dari .nokos' }, { quoted: m })
    if (!session.serviceId || !session.countryId || !session.countryName) return sock.sendMessage(jid, { text: '❌ Sesi hilang, ulangi dari .nokos' }, { quoted: m })

    const found = await findPriceItem(session, providerId, serverId)
    if (found.error === 'provider') return sock.sendMessage(jid, { text: '❌ Gagal memuat data dari provider, coba lagi.' }, { quoted: m })
    if (found.error) return sock.sendMessage(jid, { text: '❌ Pilihan tidak ditemukan, ulangi dari .nokos' }, { quoted: m })
    if (!(found.stock > 0)) return sock.sendMessage(jid, { text: '❌ Stok baru saja habis, pilih yang lain.' }, { quoted: m })
    if (!validPrice(found.price)) return sock.sendMessage(jid, { text: '❌ Harga tidak valid, hubungi owner.' }, { quoted: m })

    session.providerId = providerId
    session.serverId = serverId
    session.price = found.price
    session.operatorId = null

    const res = await getOperators(session.countryName, providerId)
    const buttons = []
    if (res.success && Array.isArray(res.data) && res.data.length) {
      res.data.forEach(op => buttons.push({
        name: 'quick_reply',
        buttonParamsJson: JSON.stringify({ display_text: `📶 ${op.name}`, id: `.nokos confirm ${op.id}` })
      }))
    } else {
      buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '📶 Random (Any)', id: '.nokos confirm any' }) })
    }
    buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔙 Kembali', id: `.nokos stok ${session.countryId} 1` }) })

    return sock.sendButton(jid, {
      text: `📶 *PILIH OPERATOR*\nNegara: ${session.countryName}\nHarga: ${formatRupiah(session.price)}`,
      footer: toko.footer, buttons, bottom_sheet: true, bottom_name: 'Operator'
    }, { quoted: m })
  }

  // ===== LEVEL 5: KONFIRMASI =====
  if (sub === 'confirm') {
    if (!SAFE.test(args[1] || '')) return sock.sendMessage(jid, { text: '❌ Operator tidak valid, ulangi dari .nokos' }, { quoted: m })
    if (!validPrice(session.price) || !session.providerId) return sock.sendMessage(jid, { text: '❌ Sesi order hilang, ulangi dari .nokos' }, { quoted: m })
    session.operatorId = args[1]
    if (user.saldo < session.price) {
      return sock.sendButton(jid, {
        text: `❌ *SALDO TIDAK CUKUP*\nHarga: ${formatRupiah(session.price)}\nSaldo Anda: ${formatRupiah(user.saldo)}`,
        footer: toko.footer,
        buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '💳 Isi Saldo', id: '.depo' }) }],
        bottom_sheet: false
      }, { quoted: m })
    }
    return sock.sendButton(jid, {
      text: `🛒 *KONFIRMASI PESANAN*\n\nNegara: ${session.countryName}\nOperator: ${session.operatorId}\nHarga: ${formatRupiah(session.price)}\nSisa saldo jika bayar: ${formatRupiah(user.saldo - session.price)}`,
      footer: toko.footer,
      buttons: [
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '💵 Bayar Sekarang', id: '.nokos pay' }) },
        { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '❌ Batal', id: '.nokos svc 1' }) }
      ],
      bottom_sheet: false
    }, { quoted: m })
  }

  // ===== LEVEL 6: BAYAR =====
  if (sub === 'pay') {
    if (session.isProcessing) return sock.sendMessage(jid, { text: '⏳ Sedang diproses, tunggu sebentar.' }, { quoted: m })
    if (!validPrice(session.price) || !session.countryId || !session.providerId || !session.operatorId) return sock.sendMessage(jid, { text: '❌ Sesi order hilang, ulangi dari .nokos' }, { quoted: m })

    session.isProcessing = true
    let charged = false, ordered = false
    const price = session.price
    try {
      // Cek ulang harga & stok tepat sebelum menagih
      const found = await findPriceItem(session, session.providerId, session.serverId)
      if (found.error) return await sock.sendMessage(jid, { text: '❌ Gagal memverifikasi harga/stok, ulangi dari .nokos' }, { quoted: m })
      if (!(found.stock > 0)) return await sock.sendMessage(jid, { text: '❌ Stok baru saja habis, pilih yang lain.' }, { quoted: m })
      if (found.price !== price) {
        session.price = found.price
        return await sock.sendButton(jid, {
          text: `⚠️ *HARGA BERUBAH*\nHarga sekarang: ${formatRupiah(found.price)}\nSilakan konfirmasi ulang.`,
          footer: toko.footer,
          buttons: [{ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '✅ Lanjut', id: `.nokos confirm ${session.operatorId}` }) }],
          bottom_sheet: false
        }, { quoted: m })
      }
      if (user.saldo < price) return await sock.sendMessage(jid, { text: '❌ Saldo tidak mencukupi.' }, { quoted: m })

      await sock.sendMessage(jid, { text: '🔄 Memproses pesanan...' }, { quoted: m })

      // Saldo dipotong dulu, dikembalikan kalau order gagal
      user.saldo -= price; charged = true
      saveNokosDB()

      const opId = session.operatorId === 'any' ? '' : session.operatorId
      const res = await createOrder(session.countryId, session.providerId, opId)

      if (res.success && res.data && res.data.order_id) {
        const orderId = res.data.order_id
        global.nokosDB.pendingOtps.push({ orderId, jid, price, itemName: res.data.service, countryName: res.data.country, startTime: Date.now() })
        global.nokosDB.orders.push({ trxId: orderId, jid, type: 'otp', item: res.data.service, price, date: new Date().toLocaleDateString('id-ID'), status: 'pending' })
        ordered = true
        saveNokosDB()

        // Reset sesi supaya tombol "Bayar" lama tidak bisa dipencet dua kali
        session.price = null; session.providerId = null; session.serverId = null; session.operatorId = null

                await sock.sendButton(jid, {
          text: `✅ *PESANAN BERHASIL!*\n\nOrder ID: ${orderId}\nNomor: ${res.data.phone_number}\nLayanan: ${res.data.service}\nHarga: ${formatRupiah(price)}\n\n🔄 Kode OTP dikirim otomatis begitu masuk. Kalau belum muncul, tekan *Cek OTP*.\n⏳ Jika 15 menit tidak masuk, saldo dikembalikan otomatis.`,
          footer: toko.footer,
          buttons: [
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '🔄 Cek OTP', id: `.nokos cek ${orderId}` }) },
            { name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: '❌ Batalkan Pesanan', id: `.nokos cancel ${orderId}` }) }
          ],
          bottom_sheet: false
        }, { quoted: m })
      } else {
        user.saldo += price; charged = false
        saveNokosDB()
        await sock.sendMessage(jid, { text: `❌ Gagal order: ${res.message || 'Stok habis/koneksi provider terputus.'}\nSaldo tidak terpotong.` }, { quoted: m })
      }
    } catch (e) {
      console.error('[ NOKOS PAY ]', e)
      if (charged && !ordered) { user.saldo += price; saveNokosDB() }   // jangan sampai saldo hilang tanpa order
    } finally {
      session.isProcessing = false
    }
    return
  }

  // ===== CEK OTP MANUAL =====
  if (sub === 'cek') {
    const orderId = args[1]
    if (!SAFE.test(orderId || '')) return sock.sendMessage(jid, { text: '❌ Order ID tidak valid.' }, { quoted: m })
    const pending = global.nokosDB.pendingOtps.find(p => p.orderId === orderId && p.jid === jid)
    if (!pending) return sock.sendMessage(jid, { text: '✅ Pesanan ini sudah selesai atau dibatalkan. Kode OTP sudah dikirim di chat ini sebelumnya.' }, { quoted: m })
    if (pending.lastManual && Date.now() - pending.lastManual < 5000) return sock.sendMessage(jid, { text: '⏳ Tunggu beberapa detik sebelum cek lagi.' }, { quoted: m })
    pending.lastManual = Date.now()

    const r = await pollOrder(pending, false)        // hasil 'delivered'/'refunded' sudah dikirim oleh pollOrder
    if (r === 'waiting') return sock.sendMessage(jid, { text: '⏳ Kode OTP belum masuk. Pastikan kamu sudah meminta kode di aplikasi tujuan, lalu cek lagi.' }, { quoted: m })
    if (r === 'error') return sock.sendMessage(jid, { text: '⚠️ Gagal menghubungi provider, coba lagi sebentar.' }, { quoted: m })
    return
  }

  // ===== CANCEL MANUAL =====
  if (sub === 'cancel') {
    const orderId = args[1]
    const pending = global.nokosDB.pendingOtps.find(p => p.orderId === orderId && p.jid === jid)
    if (!pending) return sock.sendMessage(jid, { text: '❌ Pesanan tidak ditemukan atau sudah selesai.' }, { quoted: m })

    const WAIT_MS = 3 * 60 * 1000 + 20 * 1000
    const elapsed = Date.now() - pending.startTime
    if (elapsed < WAIT_MS) {
      const remaining = Math.ceil((WAIT_MS - elapsed) / 1000)
      return sock.sendMessage(jid, { text: `⏳ Harap tunggu ${Math.floor(remaining / 60)}m ${remaining % 60}d lagi sebelum bisa membatalkan.` }, { quoted: m })
    }

    // Batalkan di provider DULU; saldo hanya dikembalikan kalau provider mengonfirmasi
    if (pending.canceling) return sock.sendMessage(jid, { text: '⏳ Pembatalan sedang diproses.' }, { quoted: m })
    pending.canceling = true
    let ok = false
    try { ok = await cancelAtProvider(orderId) } finally { pending.canceling = false }
    if (!ok) return sock.sendMessage(jid, { text: '❌ Provider belum bisa membatalkan pesanan ini (OTP mungkin sudah masuk). Tunggu sebentar lalu coba lagi.' }, { quoted: m })

    if (!refundPending(pending)) return sock.sendMessage(jid, { text: '✅ Pesanan sudah otomatis diproses sebelumnya.' }, { quoted: m })
    return sock.sendMessage(jid, { text: `❌ *PESANAN DIBATALKAN*\nSaldo ${formatRupiah(pending.price)} telah dikembalikan.` }, { quoted: m })
  }
}

handler.command = ['nokos']
handler.tags = ['nokos', 'otp']
handler.private = true
export default handler
