import { saveDB } from '../lib/database.js';

let handler = async (m, { sock, command, text, prefix, reply, jid }) => {
    if (text && text.startsWith('confirm_delprod|')) {
        let prodId = text.split('|')[1];
        
        if (prodId === 'all') {
            global.db.products = {};
            saveDB(global.db);
            return reply('[  !  ] Berhasil menghapus semua produk dari database.');
        }

        if (global.db.products[prodId]) {
            let prodName = global.db.products[prodId].name;
            delete global.db.products[prodId];
            saveDB(global.db);
            return reply(`[  !  ] Berhasil menghapus produk: *${prodName}*`);
        }
        return reply('[  !  ] Produk tidak ditemukan.');
    }

    if (text && text.startsWith('delprod_target|')) {
        let prodId = text.split('|')[1];
        let caption = '';
        
        if (prodId === 'all') {
            caption = 'Data tidak bisa dipulihkan setelah dihapus\nApakah kamu yakin ingin menghapus SEMUA produk dari database?';
        } else {
            let product = global.db.products[prodId];
            if (!product) return reply('[  !  ] Produk tidak ditemukan.');
            caption = `Data tidak bisa dipulihkan setelah dihapus\nApakah kamu yakin ingin menghapus produk *${product.name.toUpperCase()}* beserta seluruh variannya?`;
        }

        return await sock.sendButton(jid, {
            caption: caption,
            buttons: [
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Ya", id: `${prefix + command} confirm_delprod|${prodId}` }) },
                { name: "quick_reply", buttonParamsJson: JSON.stringify({ display_text: "Tidak", id: `${prefix}menu` }) }
            ],
            bottom_sheet: false
        }, { quoted: m });
    }

    const products = Object.values(global.db.products || {});
    if (products.length === 0) return reply('[  !  ] Belum ada produk di database.');

    let productRows = products.map(p => ({
        id: `${prefix + command} delprod_target|${p.id}`,
        title: p.name,
        description: `Tipe: ${p.type.toUpperCase()} | Varian: ${p.variants?.length || 0}`
    }));

    return await sock.sendButton(jid, {
        caption: `Pilih produk yang ingin dihapus:`,
        buttons: [
            {
                name: "single_select",
                buttonParamsJson: JSON.stringify({ 
                    title: "Pilih Produk", 
                    sections: [{ title: "Daftar Produk", rows: productRows }] 
                })
            },
            {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({ display_text: "Hapus Semua Produk", id: `${prefix + command} delprod_target|all` })
            }
        ],
        bottom_sheet: true,
        bottom_name: "Kelola Produk"
    }, { quoted: m });
};

handler.command = ['delproduk', 'hapusproduk'];
handler.tags = ['owner'];
handler.owner = true;

export default handler;
