import fs from 'fs';
import { saveDB } from '../lib/database.js';

let handler = async (m, { sock, text }) => {
    if (!text) {
        const filePath = './templates/addproduk.html';
        if (!fs.existsSync(filePath)) return m.reply('Template HTML tidak ditemukan!');

        try {
            const namaToko = global.nama?.toko || global.toko?.nama || 'ꭵm #ʝɛɛʏɦօֆȶɨռɢȶ.ʍɛ ᶻ 𝗓';
            let categories = [];
            if (global.db && global.db.products) {
                categories = [...new Set(Object.values(global.db.products).map(p => p.cat))];
            }

            let htmlContent = fs.readFileSync(filePath, 'utf-8');
            htmlContent = htmlContent.replace('[[TOKO_NAME]]', namaToko);
            htmlContent = htmlContent.replace('"[[CATEGORIES]]"', JSON.stringify(categories));

            await sock.sendMessage(m.key.remoteJid, {
                document: Buffer.from(htmlContent, 'utf-8'),
                mimetype: 'text/html',
                fileName: 'Jeeyhostimg_AddProduct.html',
                caption: `📦 *Jeeyhosting Add Product Bridge*\n\n1. Ketik .tourl sambil membalas file ini\n2. Buka link nya menggunakan Browser\n3. Isi detail produk & Generate kodenya\n4. Salin kodenya dan kirimkan ke bot ini.`
            }, { quoted: m });
            return;
        } catch (e) {
            console.error(e);
            return m.reply('Terjadi kesalahan saat memproses template HTML.');
        }
    }

    try {
        const decodedString = decodeURIComponent(atob(text));
        const productsArray = JSON.parse(decodedString);

        if (!Array.isArray(productsArray) || productsArray.length === 0) {
            throw new Error('Data tidak valid! Harus berupa array produk.');
        }

        if (!global.db.products) global.db.products = {};

        let response = `✅ *Berhasil Menambah ${productsArray.length} Produk!*\n\n`;

        for (let i = 0; i < productsArray.length; i++) {
            const prod = productsArray[i];
            const productId = 'PROD' + Date.now() + i + Math.floor(Math.random() * 100);
            
            global.db.products[productId] = {
                id: productId,
                ...prod,
                createdAt: new Date()
            };

            response += `> *${prod.name}*\n`;
            response += `  ID: ${productId}\n`;
            response += `  Tipe: ${prod.type === 'static' ? 'Statis' : 'Dinamis'}\n`;
            
            if (prod.variants) {
                response += `  Total Varian: ${prod.variants.length}\n`;
                if (prod.type === 'dynamic') {
                    let totalStock = 0;
                    prod.variants.forEach(v => {
                        if (v.stocks) totalStock += v.stocks.length;
                    });
                    response += `  Total Stok: ${totalStock}\n`;
                }
            }
            response += `\n`;
        }
        
        saveDB(global.db);
        await m.reply(response.trim());
    } catch (e) {
        console.error(e);
        await m.reply('❌ Gagal memproses data. Pastikan kode yang disalin sudah benar.');
    }
};

handler.command = ['addproduk'];
handler.tags = ['owner']
handler.owner = true;

export default handler;
