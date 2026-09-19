let handler = async (m, { sock, text, reply, jid, prefix, command }) => {
    let rawProducts = Object.values(global.db.products || {});
    if (rawProducts.length === 0) return reply('Produk tidak tersedia.');

    const products = rawProducts.sort((a, b) => {
        let catA = (a.cat || '').toLowerCase();
        let catB = (b.cat || '').toLowerCase();
        return catA.localeCompare(catB);
    });

    if (text) {
        let product;
        const index = parseInt(text) - 1;

        if (!isNaN(index) && index >= 0 && index < products.length) {
            product = products[index];
        } else {
            product = products.find(p => p.name.toLowerCase().includes(text.toLowerCase()));
        }

        if (!product) return reply('Produk tidak ditemukan.');

        let cards = product.variants.map((v, i) => {
            let fieldDetails = '';
            if (v.fields) {
                v.fields.forEach(f => {
                    if (f.key && f.value) fieldDetails += `\n   └ ${f.key}: ${f.value}`;
                });
            }

            let stockInfo = product.type === 'dynamic' ? `\n   └ Stok: ${v.stocks ? v.stocks.length : 0}` : '';

            let caption = `┌  Varian [${i + 1}/${product.variants.length}]\n` +
                          `│  Harga: Rp${v.price.toLocaleString()}\n` +
                          `└  ──────────────────` + 
                          `${fieldDetails}` +
                          `${stockInfo}\n\n` +
                          `Klik tombol dibawah untuk order.`;

            return {
                image: global.thumb?.produk || 'https://via.placeholder.com/600x300.png',
                caption: caption,
                buttons: [
                    {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: `Beli`,
                            id: `.checkout ${product.id} ${i}`
                        })
                    }
                ]
            };
        });

        return await sock.sendCard(jid, {
            text: `*Nama:* ${product.name}\n*Kategori:* ${product.cat}\n*Deskripsi:* ${product.desc || '-'}`,
            footer: global.toko?.footer || "Store",
            quoted: m,
            sender: m.sender,
            cards: cards
        });
    }

    let categories = [...new Set(products.map(p => p.cat))];
    let msg = `「 𝗟𝗜𝗦𝗧 𝗣𝗥𝗢𝗗𝗨𝗞 」\nᯤ.﹀﹀﹀﹀﹀﹀﹀﹀﹀.ᯤ\n\n`;
    
    let currentNumber = 1;
    categories.forEach(cat => {
        msg += `𐚁๋࣭⭑  ${cat.toUpperCase()}\n`;
        products.filter(p => p.cat === cat).forEach(p => {
            msg += `   │ ${currentNumber}. ${p.name}\n`;
            currentNumber++;
        });
        msg += `   └───────────────────┘\n\n`;
    });

    msg += `ⓘ _Gunakan *${prefix + command} [Nama/Angka Urutan]* untuk melihat detail varian dan membelinya._\n`;
    msg += `ⓘ _Contoh: *${prefix + command} 1* atau *${prefix + command} Netflix*_`;

    reply(msg);
};

handler.command = ['produk', 'list'];
handler.tags = ['store'];

export default handler;
