let handler = async (m, { sock, text, reply, jid }) => {
    if (!text) {
        return reply(
            `Format salah!\n\n` +
            `Contoh:\n` +
            `.cekidch https://whatsapp.com/channel/0029Vb...`
        )
    }

    let link = text.trim()

    if (!link.includes('whatsapp.com/channel/')) {
        return reply('Link channel tidak valid.')
    }

    let code = link.split('/channel/')[1]?.split('?')[0]

    if (!code) {
        return reply('ID channel tidak ditemukan.')
    }

    try {
        let result = await sock.newsletterMetadata(
            "invite",
            code
        )

        let id = result.id
        let meta = result.thread_metadata

        await sock.sendButton(jid, {
            text:
`*INFORMASI CHANNEL*
*Nama:*
${meta.name?.text || '-'}
*ID Channel:*
${result.id}
*Subscriber:*
${Number(meta.subscribers_count || 0).toLocaleString('id-ID')}
*Status Verifikasi:*
${meta.verification || '-'}
*Status Channel:*
${result.state?.type || '-'}
*Tanggal Dibuat:*
${new Date(Number(meta.creation_time) * 1000).toLocaleString('id-ID')}
`,
            footer: global.toko.footer,
            buttons: [
                {
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                        display_text: "Salin ID",
                        copy_code: id
                    })
                }
            ]
        }, { quoted: m })

    } catch (e) {
        reply('Gagal mengambil data channel.')
    }
}

handler.command = ['cekidch', 'idch']
handler.tags = ['tools']

export default handler