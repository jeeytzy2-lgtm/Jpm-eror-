import { getNokosUser } from '../lib/nokosDB.js'
const formatRupiah = (n) => 'Rp ' + Number(n).toLocaleString('id-ID')

let handler = async (m, { sock, jid }) => {
  const user = getNokosUser(jid)
  await sock.sendMessage(jid, { text: `💰 Saldo Anda: *${formatRupiah(user.saldo)}*` }, { quoted: m })
}
handler.command = ['saldo']
handler.tags = ['nokos']
handler.private = true
export default handler
