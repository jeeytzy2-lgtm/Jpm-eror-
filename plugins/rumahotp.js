import axios from 'axios'

const BASE = 'https://www.rumahotp.io'
const API_KEY = global.rumahOtpApiKey || 'rk-dev-wvI07Td8bDc1O8EZnDC9uQFI6E84xgfS'

async function reqOtp(endpoint) {
  try {
    const res = await axios.get(`${BASE}${endpoint}`, {
      headers: { 'x-apikey': API_KEY, 'Accept': 'application/json' },
      timeout: 20000
    })
    return res.data
  } catch (e) {
    return { success: false, message: e.message, data: e.response ? e.response.data : null }
  }
}

export const getServices = () => reqOtp('/api/v2/services')
export const getCountries = (serviceId) => reqOtp(`/api/v2/countries?service_id=${serviceId}`)
export const getOperators = (country, providerId) => reqOtp(`/api/v2/operators?country=${encodeURIComponent(country)}&provider_id=${providerId}`)
export const createOrder = (numberId, providerId, operatorId) => reqOtp(`/api/v2/orders?number_id=${numberId}&provider_id=${providerId}&operator_id=${operatorId || ''}`)
export const getOrderStatus = (orderId) => reqOtp(`/api/v1/orders/get_status?order_id=${orderId}`)
export const cancelOrder = (orderId) => reqOtp(`/api/v1/orders/set_status?order_id=${orderId}&status=cancel`)
export const createDeposit = (amount) => reqOtp(`/api/v2/deposit/create?amount=${amount}&payment_id=qris2`)
export const getDepositStatus = (depositId) => reqOtp(`/api/v2/deposit/get_status?deposit_id=${depositId}`)
export const cancelDepositApi = (depositId) => reqOtp(`/api/v1/deposit/cancel?deposit_id=${depositId}`)