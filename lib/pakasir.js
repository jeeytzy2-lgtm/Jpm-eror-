import axios from 'axios'

// Payment gateway Pakasir (https://pakasir.com/p/docs) — integrasi via API (QRIS)
const BASE = 'https://app.pakasir.com'

const conf = () => ({
  project: global.pakasir?.project || '',
  apiKey: global.pakasir?.apiKey || ''
})

async function call(method, path, payload) {
  const { project, apiKey } = conf()
  if (!project || !apiKey) {
    return { success: false, message: 'Slug / API key Pakasir belum diisi di config.js', data: null }
  }
  const auth = { project, api_key: apiKey }
  try {
    const res = await axios({
      method,
      url: `${BASE}${path}`,
      ...(method === 'get' ? { params: { ...auth, ...payload } } : { data: { ...auth, ...payload } }),
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: 20000
    })
    return { success: true, data: res.data }
  } catch (e) {
    const body = e.response?.data
    return {
      success: false,
      status: e.response?.status,
      message: (typeof body === 'object' && (body?.message || body?.error)) || e.message,
      data: body || null
    }
  }
}

// amount = nominal transaksi (TANPA biaya). Biaya dibebankan ke pembeli dan muncul di payment.fee / total_payment.
export const createQris = (orderId, amount) => call('post', '/api/transactioncreate/qris', { order_id: orderId, amount })
export const getTransaction = (orderId, amount) => call('get', '/api/transactiondetail', { order_id: orderId, amount })
export const cancelTransaction = (orderId, amount) => call('post', '/api/transactioncancel', { order_id: orderId, amount })
// Hanya jalan kalau proyek masih mode Sandbox
export const simulatePayment = (orderId, amount) => call('post', '/api/paymentsimulation', { order_id: orderId, amount })
