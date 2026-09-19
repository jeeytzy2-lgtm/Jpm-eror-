let handler = async (m, { sock, command, jid }) => {
    let owners = global.owner || []

    if (owners.length < 1) {
        return m.reply('Owner tidak tersedia.')
    }

    let buttons = owners.map(num => {
        let cleanNum = num.replace(/[^0-9]/g, '')
        let waLink = `https://wa.me/${cleanNum}`

        return {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
                display_text: `${cleanNum}`,
                url: waLink,
                merchant_url: waLink
            })
        }
    })

    await sock.sendButton(jid, {
        image: {
            url: global.thumb.help || 'https://cdn.zass.in/lDfoK8Uazn.jpg'
        },
        caption:
`Haii *${m.pushName || 'Kak'}* 👋

Jika ada pertanyaan, kendala transaksi, atau ingin request produk tertentu, silakan hubungi ${command} melalui tombol di bawah yaa~`,
        footer: global.toko?.footer || 'ꭵm #ʝɛɛʏɦօֆȶɨռɢȶ.ʍɛ ᶻ 𝗓',
        buttons,
        bottom_sheet: false
    }, { quoted: m })
}

handler.command = ['owner', 'cs']
handler.tags = ['bantuan']

export default handler