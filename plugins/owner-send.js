let handler = async (m, { sock, text, reply, isOwner }) => {
    if (!text || !text.includes('|')) {
        return reply(
            `Format salah!\n\n` +
            `Contoh:\n` +
            `.kirim 628xxx|Halo bang`
        )
    }

    let [number, ...msg] = text.split('|')

    let pesan = msg.join('|').trim()

    number = number.replace(/[^0-9]/g, '')

    if (!number || !pesan) {
        return reply('Nomor atau pesan tidak valid.')
    }

    let jid = number + '@s.whatsapp.net'

    try {
        let check = await sock.onWhatsApp(jid)

        if (!check || !check[0]?.exists) {
            return reply('Nomor tersebut tidak terdaftar di WhatsApp.')
        }

        await sock.sendMessage(jid, {
            text: pesan
        })

        reply(
            `Berhasil mengirim pesan ke:\n` +
            `${number}`
        )
    } catch (e) {
        console.error(e)

        reply(
            `Gagal mengirim pesan.\n\n` +
            `${e.message}`
        )
    }
}

handler.command = ['kirim', 'send']
handler.tags = ['owner']
handler.owner = true

export default handler