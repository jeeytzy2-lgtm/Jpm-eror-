import { saveDB } from '../lib/database.js';

let handler = async (m, { sock, command, text, reply, sender, jid }) => {
    if (!global.db.orders) global.db.orders = {};
    if (!global.db.users) global.db.users = {};
    if (!global.db.products) global.db.products = {};

    const userData = global.db.users[sender];
    const userOrders = Object.values(global.db.orders).filter(o => o.userid === sender);

    if (userOrders.length === 0 || !userData || !userData.txHistory || userData.txHistory.length === 0) {
        return reply('🛍️ Kamu belum memiliki riwayat transaksi apa pun di toko kami.');
    }

    const args = text ? text.split(' ') : [];
    const filter = args[0]?.toLowerCase();

    if (!filter || !['statis', 'dinamis', 'semua'].includes(filter)) {
        return await sock.sendButton(jid, {
            caption: `Silakan pilih jenis riwayat transaksi yang ingin kamu tampilkan di bawah ini:`,
            buttons: [
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Produk Statis", id: `.history statis` }) },
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Produk Dinamis", id: `.history dinamis` }) },
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Semua Transaksi", id: `.history semua` }) }
            ],
            bottom_sheet: false
        }, { quoted: m });
    }

    let filteredOrders = userOrders;
    if (filter === 'statis') {
        filteredOrders = userOrders.filter(o => {
            const p = global.db.products[o.prodId];
            return p && p.type === 'static';
        });
    } else if (filter === 'dinamis') {
        filteredOrders = userOrders.filter(o => {
            const p = global.db.products[o.prodId];
            return p && p.type === 'dynamic';
        });
    }

    if (filteredOrders.length === 0) {
        return reply(`🛍️ Kamu tidak memiliki riwayat transaksi untuk kategori *${filter.toUpperCase()}*.`);
    }

    const sortedOrders = filteredOrders.sort((a, b) => b.timestamp - a.timestamp);
    const defaultImg = global.payment?.qris || 'https://via.placeholder.com/400x400.png?text=Neromatic+Store';
    let cards = [];

    for (let order of sortedOrders) {
        const product = global.db.products[order.prodId] || { name: 'Produk Dihapus', type: 'static' };
        const variant = product.variants?.[order.varIdx] || { name: 'Standard', price: 0 };
        const totalHarga = variant.price ? `Rp${variant.price.toLocaleString()}` : 'Rp0';
        
        const tgl = new Date(order.timestamp).toLocaleString('id-ID', {
            timeZone: 'Asia/Jakarta',
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        let statusBadge = '⏳ PENDING';
        if (order.status === 'WAITING_CONFIRMATION') statusBadge = 'MENUNGGU KONFIRMASI';
        if (order.status === 'SUCCESS') statusBadge = 'SUKSES';
        if (order.status === 'CANCELLED') statusBadge = 'DIBATALKAN';
        if (order.status === 'EXPIRED') statusBadge = 'EXPIRED / HANGUS';

        let cardCaption = `*Invoice:* ${order.id}\n` +
                          `*Produk:* ${product.name}\n` +
                          `*Varian:* ${product.type === 'static' ? 'Standard' : variant.name}\n` +
                          `*Total:* ${totalHarga}\n` +
                          `*Waktu:* ${tgl} WIB\n\n` +
                          `*Status:* ${statusBadge}`;

        cards.push({
            image: defaultImg,
            caption: cardCaption,
            buttons: [
                {
                    name: "cta_copy",
                    buttonParamsJson: JSON.stringify({
                        display_text: order.id,
                        id: order.id,
                        copy_code: order.id
                    })
                }
            ]
        });
    }

    return await sock.sendCard(jid, {
        text: `*RIWAYAT TRANSAKSI - ${filter.toUpperCase()}*`,
        footer: global.toko?.footer || "Neromatic Store",
        quoted: m,
        sender: sender,
        cards: cards
    });
};

handler.command = ['history', 'riwayat', 'tx'];
handler.tags = ['store'];

export default handler;
