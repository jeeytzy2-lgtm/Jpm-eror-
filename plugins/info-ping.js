let handler = async (m, { sock }) => {
    let start = Date.now()
    let msg = await sock.sendMessage(m.key.remoteJid, { text: 'Testing speed...' }, { quoted: m })
    let speed = Date.now() - start
    await sock.sendMessage(m.key.remoteJid, { text: `Pang!\nRespon: ${speed} ms` }, { quoted: msg })
}

handler.command = ['ping']
handler.tags = ['info']
handler.help = ['ping', 'monitor']

export default handler