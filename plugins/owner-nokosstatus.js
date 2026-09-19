import { checkerInfo } from '../lib/nokosChecker.js'
import { getBalance } from '../lib/rumahotp.js'

const ago = (t) => (t ? `${Math.round((Date.now() - t) / 1000)} detik lalu` : 'belum pernah')

let handler = async (m, { sock, jid }) => {
  const i = checkerInfo()
  const bal = await getBalance()
  const balText = bal && bal.success && bal.data ? bal.data.formated || bal.data.balance : `GAGAL (${bal?.message || 'tanpa respons'})`
  const text = [
    '🔧 *STATUS SISTEM NOKOS*',
    '',
    `Pengecek aktif: ${i.running ? '✅ ya' : '❌ TIDAK (tambahkan startNokosChecker(sock) di index.js)'}`,
    `Cek deposit terakhir: ${ago(i.depTick)}`,
    `Cek OTP terakhir: ${ago(i.otpTick)}`,
    `Deposit menunggu: ${i.pendingDeposits}`,
    `OTP menunggu: ${i.pendingOtps}`,
    '',
    `Slug Pakasir terisi: ${global.pakasir?.project ? '✅' : '❌'}`,
    `API key Pakasir terisi: ${global.pakasir?.apiKey ? '✅' : '❌'}`,
    `API key RumahOTP terisi: ${global.rumahOtpApiKey ? '✅' : '❌'}`,
    `Saldo RumahOTP: ${balText}`,
    '',
    `Error OTP terakhir: ${i.lastOtpError || '-'}`,
    `Error deposit terakhir: ${i.lastDepError || '-'}`
  ].join('\n')
  await sock.sendMessage(jid, { text }, { quoted: m })
}

handler.command = ['nokosstatus', 'cekbot']
handler.tags = ['owner']
handler.owner = true
export default handler