import axios from 'axios';
import FormData from 'form-data';

let handler = async (m, { sock, jid, command, prefix, reply }) => {
    let quoted = m.quoted ? m.quoted : m;
    let mime = (quoted.msg || quoted).mimetype || '';

    if (!mime && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        let qMsg = m.message.extendedTextMessage.contextInfo.quotedMessage;
        let type = Object.keys(qMsg)[0];
        let msg = qMsg[type];
        if (msg.mimetype) {
            quoted = { msg: msg, mtype: type };
            mime = msg.mimetype;
        }
    }

    if (!mime) return reply(`[ ! ] Kirim atau balas media dengan perintah ${prefix + command}`);

    let loading = await reply('Sedang mengunggah...');

    try {
        let media = await sock.downloadMediaMessage(quoted.msg || quoted);
        
        const formData = new FormData();
        const ext = mime.split('/')[1]?.split(';')[0] || 'bin';
        const fileName = `media_${Date.now()}.${ext}`;
        
        formData.append('file', media, { filename: fileName, contentType: mime });

        const response = await axios.post('https://cdn.zass.in/upload', formData, {
            headers: formData.getHeaders()
        });

        const result = response.data;

        if (result.success && result.url) {
            let formatSize = (result.size / 1024).toFixed(2);
            let successMsg = `BERHASIL UPLOAD\n\nURL: ${result.url}\nNama File: ${result.fileName || fileName}\nUkuran: ${formatSize} KB`;
            return await sock.sendMessage(jid, { text: successMsg, edit: loading.key });
        } else {
            throw new Error(result.message || 'Gagal upload.');
        }

    } catch (e) {
        await sock.sendMessage(jid, { text: `Gagal: ${e.response?.data?.message || e.message}`, edit: loading.key });
    }
};

handler.command = ['tourl', 'upload', 'cdn'];
handler.tags = ['tools'];

export default handler;
