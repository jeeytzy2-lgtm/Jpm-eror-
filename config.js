import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

//——————————[ Setting Dasar ]——————————//
global.namebot = "NokosOTP Official"
global.versi = "beta-1.0"
global.paircode = "JEEYVIPP"
global.owner = ["6282190044424"] // ganti dengan nomor owner
global.web = "https://jeeymarket.my.id"
global.prefix = ["!", ".", ","]
global.premium = ["62xxx"] // gausah diganti, ga dipake
global.appConfig = {
    antispam: {
        status: true, // true = aktif, false = nonaktif
        interval: 15000, // milidetik, default 15 detik
        warning: 7, // limit spam biasa
        block: 15, // limit spam auto block
        cooldown: 60000 // waktu cooldown untuk spam biasa
    }
}

//——————————[ Setting Payment Gateway & Supplier ]——————————//
global.pakasir = {
    project: "jeeyhosting",   // Slug proyek dari dashboard Pakasir
    apiKey: "1fsqXLYFEwBNXrlaZqW2oIFbtHzOgufW"      // API Key proyek dari dashboard Pakasir
}
global.rumahOtpApiKey = "rk-dev-wvI07Td8bDc1O8EZnDC9uQFI6E84xgfS"  // key baru hasil regenerate
global.nokosMargin = 1200

//——————————[ Setting Toko ]——————————//
global.toko = {
    nama: "ꭵm #ʝɛɛʏɦօֆȶɨռɢȶ.ʍɛ ᶻ 𝗓", // nama store kamu
    footer: "© 2026 ꭵm #ʝɛɛʏɦօֆȶɨռɢȶ.ʍɛ ᶻ 𝗓", // footer button 
    status: "buka" // status toko = buka/tutup
    }
    
/* 
Bagian payment ini, selain baris qris, sisanya yg dana, gopay dll bisa kalian hapus/tambah sesuka hati ya, kalau qris nya bersifat wajib, kalian bisa ubah gambar qris kalian ke link menggunakan fitur .tourl atau web berikut:
https://cdn.shirokode.web.id
*/
global.payment = {
    qris: "https://pixhost.to/show/5794/771622990_1000079595.jpg",
    dana: "6283122028438",
    gopay: "0822",
    ovo: "0822",
    shopeepay: "0822",
    neobank: "××××××",
    seabank: "901597415180"
    }
    
//——————————[ Setting Media ]——————————//
global.thumb = {
    utama: "https://cdn.zass.in/lDfoK8Uazn.jpg",
    produk: "https://cdn.shirokode.web.id/files/C14qbhyBQx.jpeg",
    help: "https://cdn.shirokode.web.id/files/9uWCfQ45qM.jpeg"
    }

//——————————[ Template Pesan ]——————————//
global.faq = [
  {
    tanya: "Gimana cara order?",
    jawab: "Ketik *.beli* lalu ikuti langkah langkah dari bot."
  },
  {
    tanya: "Gimana cara cek list nya?",
    jawab: "Ketik *.produk* lalu pilih produk yg mau kamu cek"
  },
  {
    tanya: "Metode pembayaran apa saja?",
    jawab: "Kami mendukung QRIS standar nasional yg bisa dibayar menggunakan semua bank dan e wallet yg mendukung scan qris."
  },
  {
    tanya: "Proses berapa lama?",
    jawab: "Proses 1×24 (biasanya lebih cepat) tergantung kesulitan pesanan dan nomor antrian kamu ya."
  }
]

global.mess = {
    wait: "Tunggu sebentar ya...",
    owner: "Fitur ini khusus owner!",
    admin: "Fitur ini khusus admin!",
    premium: "Fitur ini khusus premium!",
    group: "Fitur ini hanya bisa digunakan di dalam group!",
    private: "Fitur ini hanya bisa di private chat!"
}

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update config.js"))
  import(`${file}?update=${Date.now()}`)
})