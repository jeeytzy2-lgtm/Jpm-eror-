import './config.js'
import readline from 'readline'
import os from 'os'
import chalk from 'chalk'
import { Boom } from '@hapi/boom'
import { showLoadingLogs } from './lib/logger.js'

import {
    useMultiFileAuthState,
    DisconnectReason
} from '@whiskeysockets/baileys'
import { initDatabase } from './lib/database.js'
import { initLidOwners, sleep } from './lib/utils.js'
import { startNokosChecker } from './lib/nokosChecker.js'
import { createSocket } from './lib/socket.js'

console.clear()

process.on('uncaughtException', console.error)

process.on('unhandledRejection', (reason, promise) => {
    console.log(
        chalk.red('[ UNHANDLED REJECTION ]'),
        promise,
        '\nReason:',
        reason
    )
})

initDatabase()

const blue = (t) => `\x1b[96m${t}\x1b[0m`
const green = (t) => `\x1b[92m${t}\x1b[0m`
const red = (t) => `\x1b[31m${t}\x1b[0m`

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const question = (text) =>
    new Promise(resolve => rl.question(text, resolve))

const normalizeNumber = (num) => {
    return num
        .replace(/[^0-9]/g, '')
        .replace(/^0/, '62')
}

async function startBot() {
    await showLoadingLogs()
    const { handler } = await import('./handler.js')
    const { state, saveCreds } = await useMultiFileAuthState('session')
    let sock = await createSocket(state)

    if (!sock.authState.creds.registered) {
        console.log(blue('Masukkan nomor WhatsApp (contoh: 628xxx)'))
        const input = await question('> ')
        const phoneNumber = normalizeNumber(input)
        console.log(blue('[ INFO ] Mengirim permintaan pairing code...'))
        
        try {
            const code = await sock.requestPairingCode(phoneNumber, global.paircode)
            console.log(green(`[ KODE PAIRING ] ${code}`))
        } catch (e) {
            console.log(red('[ ERROR ] Gagal mendapatkan pairing code'))
            console.log(red(e))
        }
    }

    sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m) return

    try {
        await handler(sock, m)
    } catch (e) {
        console.error('[ HANDLER ERROR ]', e)
    }
})

sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        console.log(red(`[ KONEKSI ] Terputus (${reason})`))

        if (reason !== DisconnectReason.loggedOut) {
            console.log(blue('[ RECONNECT ] Menyambungkan ulang...'))
            startBot()
        }
    }

    if (connection === 'open') {
        console.log(green('[ SUCCESS ] Bot berhasil terhubung'))

        await sleep(5000)

        initLidOwners(sock)
        await sock.resolveLid(sock)

        startNokosChecker(sock)
    }
})

sock.ev.on('creds.update', saveCreds)
}

startBot()
