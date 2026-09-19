let handler = async (m, { sock, prefix, jid, command }) => {
    let orders = global.db.orders || {};
    let products = global.db.products || {};
    let listOrder = Object.entries(orders);

    if (listOrder.length === 0) return m.reply('Belum ada riwayat transaksi.');

    let tableRows = [];
    let totalSukses = 0;
    let totalPending = 0;
    let totalExpired = 0;
    let totalBatal = 0;
    let totalPendapatan = 0;
    let mentions = [];

    for (let [id, data] of listOrder) {
        let userId = data.sender || data.userid;
        let mentionUser = 'unknown';

        if (userId) {
            mentionUser = `@${userId.split('@')[0]}`;
            if (!mentions.includes(userId)) {
                mentions.push(userId);
            }
        }

        let status = data.status || 'PENDING';
        let productData = products[data.prodId] || {};
        let productName = productData.name ? productData.name.trim().toLowerCase() : 'unknown';
        
        let variantName = 'normal';
        let price = 0;
        
        if (productData.variants && Array.isArray(productData.variants) && productData.variants[data.varIdx]) {
            let variant = productData.variants[data.varIdx];
            variantName = variant.name ? variant.name.trim().toLowerCase() : 'normal';
            price = variant.price ? Number(variant.price) : 0;
        }

        if (status === 'SUCCESS') {
            totalSukses++;
            totalPendapatan += price;
        } else if (status === 'PENDING') {
            totalPending++;
        } else if (status === 'EXPIRED') {
            totalExpired++;
        } else if (status === 'CANCELLED' || status === 'BATAL') {
            totalBatal++;
        }

        tableRows.push([
            id,
            mentionUser,
            productName,
            variantName,
            String(price.toLocaleString('id-ID')),
            status
        ]);
    }

    let caption = `*REKAP TRANSAKSI*\n\n` +
                  `*Total Pendapatan:* Rp ${totalPendapatan.toLocaleString('id-ID')}\n` +
                  `*Pesanan Selesai:* ${totalSukses}\n` +
                  `*Pesanan Pending:* ${totalPending}\n` +
                  `*Pesanan Expired:* ${totalExpired}\n` +
                  `*Pesanan Batal:* ${totalBatal}`;

    await sock.sendRichResponse(jid, {
        text: caption,
        table: {
            title: "Daftar Transaksi",
            headers: ["Invoice", "Pembeli", "Produk", "Varian", "Harga", "Status"],
            rows: tableRows
        },
    mentionedJid: mentions });
};

handler.command = ['rekap', 'listorder'];
handler.tags = ['owner'];
handler.owner = true;

export default handler;
