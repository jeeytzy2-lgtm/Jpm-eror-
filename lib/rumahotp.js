import axios from 'axios'

// Endpoint supplier RumahOTP (layanan, negara, operator, order, status OTP, cancel) TIDAK diubah.
// Tambahan: (1) API key dari config.js, (2) parameter di-encode, (3) pembatas kecepatan request.
// Dokumentasi RumahOTP: maksimal 5 request / 10 detik. Kalau dilanggar IP server diblokir sementara
// oleh Cloudflare, dan itu membuat status OTP tidak pernah terbaca (OTP tidak terkirim).

const BASE = 'https://www.rumahotp.io'
const getKey = () => global.rumahOtpApiKey || ''
const q = encodeURIComponent
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const limit = () => ({
  max: global.rumahOtpLimit?.max ?? 4,               // 4 dari 5 slot, 1 slot cadangan
  windowMs: global.rumahOtpLimit?.windowMs ?? 10000
})
const hits = []
let blockedUntil = 0

function used() {
  const { windowMs } = limit()
  const now = Date.now()
  while (hits.length && now - hits[0] >= windowMs) hits.shift()
  return hits.length
}

// Request dari user (klik tombol) menunggu giliran, tidak pernah ditolak
async function acquire() {
  for (;;) {
    const now = Date.now()
    if (now < blockedUntil) { await sleep(Math.min(blockedUntil - now, 2000)); continue }
    if (used() < limit().max) { hits.push(Date.now()); return }
    await sleep(Math.max(50, hits[0] + limit().windowMs - Date.now() + 20))
  }
}

// Polling di latar belakang hanya jalan kalau masih ada slot longgar (tidak menghabiskan jatah user)
export const canPoll = () => Date.now() >= blockedUntil && used() < limit().max - 1

async function reqOtp(endpoint) {
  const apiKey = getKey()
  if (!apiKey) return { success: false, message: 'API key RumahOTP belum diisi di config.js', data: null }
  await acquire()
  try {
    const res = await axios.get(`${BASE}${endpoint}`, {
      headers: { 'x-apikey': apiKey, 'Accept': 'application/json' },
      timeout: 20000
    })
    const body = res.data
    if (body && typeof body === 'object' && body.success === false && !body.message) body.message = body.error?.message
    return body
  } catch (e) {
    const status = e.response?.status
    if (status === 429 || status === 403) {
      blockedUntil = Date.now() + 30000
      console.log(`[ RUMAHOTP ] HTTP ${status}: kena limit / IP belum di-whitelist di RumahOTP. Request ditahan 30 detik.`)
    }
    const body = e.response?.data
    return {
      success: false,
      status,
      message: (body && typeof body === 'object' && (body.error?.message || body.message)) || e.message,
      data: null
    }
  }
}

export const getBalance = () => reqOtp('/api/v1/user/balance')
export const getServices = () => reqOtp('/api/v2/services')
export const getCountries = (serviceId) => reqOtp(`/api/v2/countries?service_id=${q(serviceId)}`)
export const getOperators = (country, providerId) => reqOtp(`/api/v2/operators?country=${q(country)}&provider_id=${q(providerId)}`)
export const createOrder = (numberId, providerId, operatorId) => reqOtp(`/api/v2/orders?number_id=${q(numberId)}&provider_id=${q(providerId)}&operator_id=${q(operatorId || '')}`)
export const getOrderStatus = (orderId) => reqOtp(`/api/v1/orders/get_status?order_id=${q(orderId)}`)
export const cancelOrder = (orderId) => reqOtp(`/api/v1/orders/set_status?order_id=${q(orderId)}&status=cancel`)