import { saveDB } from '../lib/database.js';

let handler = async (m, { sock, command, text, prefix, reply, jid, sender }) => {
    if (text && text.startsWith('confirm_del|')) {
        let [prodId, variantIndexStr] = text.replace('confirm_del|', '').split('|');
        let product = global.db.products[prodId];
        if (!product || !product.variants) return reply('[  !  ] Produk atau varian tidak ditemukan.');

        let variantIndex = parseInt(variantIndexStr);
        if (isNaN(variantIndex) || !product.variants[variantIndex]) return reply('[  !  ] Varian tidak valid.');

        let deletedVariant = product.variants[variantIndex];
        let variantName = deletedVariant.name || `Statis (Rp ${deletedVariant.price.toLocaleString('id-ID')})`;

        product.variants.splice(variantIndex, 1);
        saveDB(global.db);

        return reply(`*VARIAN BERHASIL DIHAPUS*\n\nProduk: ${product.name}\nVarian: ${variantName}`);
    }

    if (text && text.startsWith('del_target|')) {
        let [prodId, variantIndexStr] = text.replace('del_target|', '').split('|');
        let product = global.db.products[prodId];
        if (!product) return reply('[  !  ] Produk tidak ditemukan.');
        
        let v = product.variants[variantIndexStr];
        let vName = product.type === 'static' ? `Statis - Rp ${v.price.toLocaleString('id-ID')}` : v.name;

        return await sock.sendButton(jid, {
            caption: `Tidak ada opsi pemulihan setelah ini.\nApakah kamu yakin ingin menghapus varian *${vName}* dari produk *${product.name}*?`,
            buttons: [
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Ya", id: `${prefix + command} confirm_del|${prodId}|${variantIndexStr}` }) },
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Tidak", id: `${prefix + command}` }) }
            ],
            bottom_sheet: false
        }, { quoted: m });
    }
    const products = Object.values(global.db.products || {});
    if (products.length === 0) return reply('[  !  ] Belum ada produk di database.');

    let buttons = [];

    for (const p of products) {
        if (!p.variants || p.variants.length === 0) continue;

        buttons.push({
            name: "single_select",
            buttonParamsJson: JSON.stringify({
                title: p.name,
                sections: [{
                    title: `Varian ${p.name}`,
                    rows: p.variants.map((v, index) => {
                        let label = p.type === 'static' 
                            ? `Rp ${v.price.toLocaleString('id-ID')}` 
                            : `${v.name} - Rp ${v.price.toLocaleString('id-ID')}`;
                        
                        let desc = p.type === 'static'
                            ? v.fields.map(f => `${f.key}: ${f.value}`).join(', ')
                            : `Stok: ${v.stocks?.length || 0}`;

                        return {
                            id: `${prefix + command} del_target|${p.id}|${index}`,
                            title: label,
                            description: desc
                        };
                    })
                }]
            })
        });
    }

    if (buttons.length === 0) return reply('[  !  ] Tidak ada produk yang memiliki varian.');

    return await sock.sendButton(jid, {
        caption: `Pilih produk dan varian yang ingin dihapus:`,
        footer: global.toko?.footer || "Neromatic Store",
        buttons: buttons,
        bottom_sheet: true,
        bottom_name: "Pilih Produk"
    }, { quoted: m });
};

handler.command = ['delvarian', 'hapusvarian'];
handler.tags = ['owner'];
handler.owner = true;

export default handler;
