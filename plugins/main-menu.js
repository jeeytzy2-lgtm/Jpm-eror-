import { runtime } from '../lib/utils.js'

let handler = async (m, { sock, jid, prefix, isOwner }) => {
    const plugins = Object.values(global.plugins)

    let menu = {}

    for (let plugin of plugins) {
        if (!plugin || !plugin.command || plugin.disabled) continue

        let tags = Array.isArray(plugin.tags)
            ? plugin.tags
            : [plugin.tags || 'others']

        let commands = Array.isArray(plugin.command)
            ? plugin.command
            : [plugin.command]

        for (let tag of tags) {
            if (!tag) continue

            if (tag === 'owner' && !isOwner) continue

            if (!menu[tag]) {
                menu[tag] = new Set()
            }

            for (let cmd of commands) {
                if (
                    typeof cmd === 'string' &&
                    !cmd.includes('_')
                ) {
                    menu[tag].add(cmd)
                }
            }
        }
    }

    let totalOrder = Object.keys(global.db.orders || {}).length
    let totalUsers = Object.keys(global.db.users || {}).length

    let teks =
`╭━━━〔 ${global.namebot} 〕━━━⬣
┃ ✦ Toko : ${global.toko.nama}
┃ ✦ Total Pengguna : ${totalUsers}
┃ ✦ Total Order : ${totalOrder}
┃ ✦ Status Toko : ${global.toko.status === 'buka' ? 'Buka 🟢' : 'Tutup 🔴'}
┃ ✦ Runtime : ${runtime(process.uptime())}
╰━━━━━━━━━━━━━━━━⬣

╭─────────────────────➤
`

    const productsRaw = global.db.products || {}

    const productNames = Object.values(productsRaw)
        .map(p => p.name ? p.name.trim().toLowerCase() : '')
        .filter(name => name.length > 0)

    if (productNames.length > 0) {
        teks += `│╭─▣「 *LIST PRODUK* 」▣─╮\n`

        productNames.sort().forEach(prodName => {
            teks += `││ ⟿ ${prefix}produk ${prodName}\n`
        })

        teks += `│╰─➤\n│\n`
    }

    for (let tag in menu) {
        let title = tag.replace(/[-_]/g, ' ').toUpperCase()

        teks += `│╭─▣「 *${title} MENU* 」▣─╮\n`

        Array.from(menu[tag])
            .sort()
            .forEach(cmd => {
                teks += `││ ⟿ ${prefix}${cmd}\n`
            })

        teks += `│╰─➤\n│\n`
    }

    teks +=
`│╭==⊱ *Official Source* ▣─╮
││↻ Website: ${global.web}
│╰───➤
╰─────┈➤

  ⌕ ❙❘❙❙❘❙❚❙❘❙❙❚❙❘❙❘❙❚❙❘❙❙❚❙❘❙❙❘❙❚❙❘ ⌕
  『 *${global.toko.footer}* 』
`

    await sock.sendMessage(jid, {
        image: { url: global.thumb.utama },
        caption: teks
    }, { quoted: m })
}

handler.command = ['menu', 'help']
handler.tags = ['main']

export default handler