let handler = async (m, { sock, jid }) => {
    let paymentData = global.payment || {};
    
    if (Object.keys(paymentData).length === 0) return m.reply('Belum ada data pembayaran di database.');

    let qrisUrl = paymentData.qris || '';
    let captionArr = [];

    captionArr.push(`╭──⧼ scan here ⧽`);
    
    for (let [method, value] of Object.entries(paymentData)) {
        let formattedMethod = method.charAt(0).toUpperCase() + method.slice(1);
        captionArr.push(`│┃⤿ ֵ 𝖼⃘𐑋  ˒˓ ${formattedMethod} ⨾ ${value}`);
    }
    
    captionArr.push(`╰─────────────❏`);

    let caption = captionArr.join('\n');

    if (qrisUrl && qrisUrl.trim() !== '') {
        try {
            await sock.sendMessage(jid, {
                image: { url: qrisUrl },
                caption: caption
            }, { quoted: m });
        } catch (err) {
            await sock.sendMessage(jid, {
                text: caption
            }, { quoted: m });
        }
    } else {
        await sock.sendMessage(jid, {
            text: caption
        }, { quoted: m });
    }
};

handler.command = ['payment'];
handler.tags = ['store'];

export default handler;
